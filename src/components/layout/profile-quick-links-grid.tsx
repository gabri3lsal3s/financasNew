import {
  Bell,
  ChevronRight,
  Compass,
  HelpCircle,
  Palette,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

interface MenuLinkProps {
  icon: typeof User;
  label: string;
  badge?: string;
  fullSpan?: boolean;
  onClick: () => void;
}

function MenuLink({ icon: Icon, label, badge, fullSpan = false, onClick }: MenuLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full min-h-11 items-center gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover/80 active:bg-surface-hover select-none cursor-pointer",
        fullSpan && "sm:col-span-2",
      )}
    >
      <Icon
        className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 text-xs font-medium text-foreground truncate">{label}</span>
      {badge && (
        <Badge variant="muted" size="xs">
          {badge}
        </Badge>
      )}
      <ChevronRight
        className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden="true"
      />
    </button>
  );
}

export interface ProfileQuickLinksGridProps {
  isPro: boolean;
  onNavigateTab: (path: string) => void;
  onOpenDemoSelect: () => void;
  onOpenHelp: () => void;
}

export function ProfileQuickLinksGrid({
  isPro,
  onNavigateTab,
  onOpenDemoSelect,
  onOpenHelp,
}: ProfileQuickLinksGridProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Acesso Rápido
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 rounded-xl border border-border/80 bg-surface p-1.5 shadow-xs">
        <MenuLink
          icon={User}
          label="Minha Conta & Perfil"
          onClick={() => onNavigateTab("/configuracoes?tab=account")}
        />
        <MenuLink
          icon={Palette}
          label="Aparência & Tema"
          onClick={() => onNavigateTab("/configuracoes?tab=appearance")}
        />
        <MenuLink
          icon={Bell}
          label="Notificações & Alertas"
          onClick={() => onNavigateTab("/configuracoes?tab=notifications")}
        />
        <MenuLink
          icon={ShieldCheck}
          label="Segurança & Dados"
          onClick={() => onNavigateTab("/configuracoes?tab=security")}
        />
        <MenuLink
          icon={Sparkles}
          label="Gerenciar Assinatura"
          badge={isPro ? "Pro" : undefined}
          fullSpan
          onClick={() => onNavigateTab("/configuracoes?tab=subscription")}
        />
        <MenuLink
          icon={Compass}
          label="Rever Tour Guiado (Modo Simulação)"
          badge="Simulação"
          fullSpan
          onClick={onOpenDemoSelect}
        />
        <MenuLink
          icon={HelpCircle}
          label="Central de Ajuda & Suporte"
          fullSpan
          onClick={onOpenHelp}
        />
      </div>
    </div>
  );
}
