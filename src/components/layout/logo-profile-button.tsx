import { useState } from "react";
import { useNavigate } from "react-router";
import {
  LogOut,
  Settings,
  Palette,
  ShieldCheck,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";
import { Modal, Button, LivePulseBeacon } from "@/components/ui";
import { BrandLogo } from "@/components/layout/brand-logo";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/data/client";
import { triggerHaptic } from "@/services/haptics";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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

interface QuickLinkProps {
  icon: typeof Settings;
  label: string;
  description: string;
  onClick: () => void;
}

function QuickLink({ icon: Icon, label, description, onClick }: QuickLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-hover hover:border-primary/30 transition-all text-left select-none cursor-pointer"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-sm text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" aria-hidden="true" />
    </button>
  );
}

/**
 * Botão da logo no header (mobile) que abre um modal de perfil do usuário.
 * Combina identidade visual da marca com acesso rápido a configurações e logout.
 */
export function LogoProfileButton() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const name: string | undefined = user?.user_metadata?.name as string | undefined;
  const email = user?.email;
  const initials = getInitials(name, email);
  const displayName = name ?? email?.split("@")[0] ?? "Usuário";

  const handleLogout = async () => {
    try {
      triggerHaptic("medium");
      setOpen(false);
      void queryClient.cancelQueries();
      queryClient.clear();
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {
      queryClient.clear();
    }
  };

  const goTo = (path: string) => {
    triggerHaptic("light");
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
          triggerHaptic("light");
          setOpen(true);
        }}
        className={cn(
          "flex items-center justify-center rounded-lg transition-all duration-150 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "hover:opacity-80",
        )}
      >
        <BrandLogo showWordmark={false} markClassName="size-7" />
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Perfil"
        hideCalculator
        size="sm"
      >
        <div className="mt-4 space-y-5">
          {/* Card de identidade do usuário */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-surface to-accent/5 p-5">
            {/* Decoração de fundo */}
            <div
              className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/6 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-6 -left-6 size-24 rounded-full bg-accent/8 blur-xl"
              aria-hidden="true"
            />

            <div className="relative flex items-center gap-4">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xl font-display shadow-md select-none">
                  {initials}
                </div>
                {/* Badge de sessão ativa */}
                <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-surface border-2 border-surface">
                  <ShieldCheck className="size-3 text-positive-strong" aria-hidden="true" />
                </span>
              </div>

              {/* Dados */}
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-base text-foreground leading-tight truncate">
                  {displayName}
                </p>
                {email && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{email}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  <LivePulseBeacon variant="positive" size="sm" />
                  <span className="text-xs font-medium text-positive-strong">Sessão Segura</span>
                </div>
              </div>
            </div>
          </div>

          {/* Atalhos rápidos */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
              Acesso Rápido
            </p>
            <QuickLink
              icon={Settings}
              label="Configurações"
              description="Conta, dados e preferências do app"
              onClick={() => goTo("/configuracoes")}
            />
            <QuickLink
              icon={Palette}
              label="Aparência"
              description="Temas, cores, animações e densidade"
              onClick={() => goTo("/configuracoes?tab=aparencia")}
            />
            <QuickLink
              icon={UserIcon}
              label="Meu Perfil"
              description="Informações da conta e segurança"
              onClick={() => goTo("/configuracoes?tab=perfil")}
            />
          </div>

          {/* Logout */}
          <div className="pt-1 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 text-danger hover:text-danger hover:bg-danger-surface"
              onClick={handleLogout}
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span>Sair da Conta</span>
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
