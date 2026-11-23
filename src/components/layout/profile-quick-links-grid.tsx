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
  description?: string;
  badge?: string;
  fullSpan?: boolean;
  onClick: () => void;
}

function MenuLink({
  icon: Icon,
  label,
  description,
  badge,
  fullSpan = false,
  onClick,
}: MenuLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full min-h-11 items-center gap-3 rounded-lg px-3.5 py-2.5 sm:px-4 sm:py-3 text-left transition-colors hover:bg-surface-hover/80 active:bg-surface-hover select-none cursor-pointer",
        fullSpan && "sm:col-span-2",
      )}
    >
      <Icon
        className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <span className="block text-xs sm:text-sm font-medium text-foreground leading-snug break-words">
          {label}
        </span>
        {description && (
          <span className="hidden sm:block text-[11px] text-muted-foreground leading-tight mt-0.5">
            {description}
          </span>
        )}
      </div>
      {badge && (
        <Badge variant="muted" size="xs" className="shrink-0">
          {badge}
        </Badge>
      )}
      <ChevronRight
        className="size-3.5 sm:size-4 shrink-0 text-muted-foreground/60 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
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
    <div className="space-y-1.5 sm:space-y-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Acesso Rápido
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-1.5 rounded-xl border border-border/80 bg-surface p-1.5 sm:p-2 shadow-xs">
        <MenuLink
          icon={User}
          label="Minha Conta & Perfil"
          description="Dados pessoais, e-mail e sessão"
          onClick={() => onNavigateTab("/configuracoes?tab=account")}
        />
        <MenuLink
          icon={Palette}
          label="Aparência & Tema"
          description="Modo escuro, cores e densidade"
          onClick={() => onNavigateTab("/configuracoes?tab=appearance")}
        />
        <MenuLink
          icon={Bell}
          label="Notificações & Alertas"
          description="Vencimentos, limites e avisos"
          onClick={() => onNavigateTab("/configuracoes?tab=notifications")}
        />
        <MenuLink
          icon={ShieldCheck}
          label="Segurança & Dados"
          description="Senha, backup e privacidade"
          onClick={() => onNavigateTab("/configuracoes?tab=security")}
        />
        <MenuLink
          icon={Sparkles}
          label="Gerenciar Assinatura"
          description="Detalhes do plano e faturamento"
          badge={isPro ? "Pro" : undefined}
          onClick={() => onNavigateTab("/configuracoes?tab=subscription")}
        />
        <MenuLink
          icon={HelpCircle}
          label="Central de Ajuda & Suporte"
          description="Dúvidas frequentes e atendimento"
          onClick={onOpenHelp}
        />
        <MenuLink
          icon={Compass}
          label="Rever Tour Guiado (Modo Simulação)"
          description="Explore trilhas práticas com dados demonstrativos sem afetar sua conta"
          badge="Simulação"
          fullSpan
          onClick={onOpenDemoSelect}
        />
      </div>
    </div>
  );
}
