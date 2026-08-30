import { useState } from "react";
import { useNavigate } from "react-router";
import {
  LogOut,
  Settings,
  Palette,
  ShieldCheck,
  ChevronRight,
  Database,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { Modal, Button, LivePulseBeacon, Badge } from "@/components/ui";
import { BrandLogo } from "@/components/layout/brand-logo";
import { SubscriptionBadge } from "@/components/modules";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserSubscription } from "@/state";
import { triggerSensory } from "@/services/sensory";
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

interface MenuLinkProps {
  icon: typeof Settings;
  label: string;
  badge?: string;
  onClick: () => void;
}

function MenuLink({ icon: Icon, label, badge, onClick }: MenuLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-hover/80 active:bg-surface-hover select-none cursor-pointer"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
      <span className="flex-1 min-w-0 text-xs font-medium text-foreground truncate">
        {label}
      </span>
      {badge && (
        <Badge variant="muted" size="xs">
          {badge}
        </Badge>
      )}
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
    </button>
  );
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

  const goTo = (path: string) => {
    triggerSensory("selection");
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
          "flex items-center justify-center rounded-lg transition-all duration-150 active:scale-95 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
      >
        <div className="space-y-4 pt-1">
          {/* Card de Identidade do Usuário */}
          <div className="flex items-center gap-3.5 rounded-xl border border-border/80 bg-surface-subtle/60 p-3.5">
            <div className="relative shrink-0">
              <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-display text-base font-bold text-white shadow-xs select-none">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-surface border border-surface">
                <ShieldCheck className="size-2.5 text-positive-strong" aria-hidden="true" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-foreground leading-snug truncate">
                {displayName}
              </p>
              {email && (
                <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                  {email}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <SubscriptionBadge status={subscription} />
                <div className="flex items-center gap-1 text-[11px] font-medium text-positive-strong">
                  <LivePulseBeacon variant="positive" size="sm" />
                  <span>Sessão Segura</span>
                </div>
              </div>
            </div>
          </div>

          {/* Banner de Upgrade para usuários que não têm o Plano Pro */}
          {!subscription.isPro && (
            <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-accent/5 p-3.5 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                    <Sparkles className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
                    <span>Desbloqueie o Plano Pro</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Aportes automáticos, múltiplos cartões e relatórios fiscais ilimitados.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-xs shrink-0 font-medium"
                  onClick={() => goTo("/assinatura")}
                >
                  <span>Assinar</span>
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {/* Grupo de Atalhos Unificado (Single Card List) */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Acesso Rápido
            </p>
            <div className="rounded-xl border border-border/80 bg-surface divide-y divide-border/50 overflow-hidden shadow-2xs">
              <MenuLink
                icon={Palette}
                label="Aparência & Tema"
                onClick={() => goTo("/configuracoes?tab=personalizacao")}
              />
              <MenuLink
                icon={Settings}
                label="Configurações Gerais"
                onClick={() => goTo("/configuracoes?tab=personalizacao")}
              />
              <MenuLink
                icon={ShieldCheck}
                label="Segurança & Perfil"
                onClick={() => goTo("/configuracoes?tab=seguranca")}
              />
              <MenuLink
                icon={Database}
                label="Dados & Backup"
                onClick={() => goTo("/configuracoes?tab=dados")}
              />
              <MenuLink
                icon={Sparkles}
                label="Gerenciar Assinatura"
                badge={subscription.isPro ? "Pro" : undefined}
                onClick={() => goTo("/configuracoes?tab=plano")}
              />
            </div>
          </div>

          {/* Rodapé: Logout e Identificação do App */}
          <div className="space-y-2 pt-1 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 text-danger hover:text-danger hover:bg-danger-surface text-xs"
              onClick={handleLogout}
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span>Sair da Conta</span>
            </Button>
            <p className="text-[10px] text-muted-foreground/60 text-center select-none">
              Guia Financeiro • v1.0.0
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
