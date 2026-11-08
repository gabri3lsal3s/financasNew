import { Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { getActivePlatform, type ActivePlatform } from "@/services/native/platform";
import { cn } from "@/lib/utils";

export interface PlatformTriptychItem {
  id: ActivePlatform;
  title: string;
  description: string;
}

const DEFAULT_PLATFORM_TRIPTYCH_ITEMS: readonly PlatformTriptychItem[] = [
  {
    id: "web_desktop",
    title: "Web Desktop",
    description:
      "Ideal para relatórios em tela ampla, simulações de independência financeira (FIRE), conciliação bancária e rebalanceamento de carteira.",
  },
  {
    id: "mobile_pwa",
    title: "Mobile PWA",
    description:
      "Acesso leve e instantâneo no iPhone ou Android, sem downloads pesados e com abertura em tela cheia.",
  },
  {
    id: "android_pro",
    title: "Android Pro Nativo",
    description:
      "Leitor passivo inteligente de notificações bancárias (Pix e cartões em tempo real), biometria física e escudo anti-print.",
  },
] as const;

export interface PlatformsTriptychCardProps {
  title?: string;
  subtitle?: string;
  activePlatform?: ActivePlatform;
  className?: string;
}

/**
 * Card comparativo do Tripé de Plataformas Áxis (Web Desktop, Mobile PWA e Android Pro).
 * Destaca visualmente a plataforma que está sendo utilizada no momento pelo usuário.
 */
export function PlatformsTriptychCard({
  title = "O Tripé de Plataformas: Web, PWA e Android Pro",
  subtitle = "Sua conta funciona em qualquer lugar com sincronização e recursos adaptados a cada formato.",
  activePlatform,
  className,
}: PlatformsTriptychCardProps) {
  const currentActivePlatform = activePlatform ?? getActivePlatform();

  return (
    <Card
      data-tour="settings-platforms-triptych"
      className={cn("border-border/80 bg-surface shadow-xs", className)}
    >
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Smartphone className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{title}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {DEFAULT_PLATFORM_TRIPTYCH_ITEMS.map((item) => {
            const isActive = item.id === currentActivePlatform;
            return (
              <div
                key={item.id}
                data-platform={item.id}
                data-active={isActive ? "true" : "false"}
                className={cn(
                  "p-3.5 rounded-xl border space-y-1.5 transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/5 shadow-2xs"
                    : "border-border/70 bg-background/50",
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={cn(
                      "font-bold block",
                      isActive ? "text-primary-strong" : "text-foreground",
                    )}
                  >
                    {item.title}
                  </span>
                  {isActive && (
                    <Badge variant="default" size="xs">
                      Em uso
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
