import { CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";

export interface AppVersionInfoBoxProps {
  displayVersion: string;
  displayBuild?: number;
  platformLabel: string;
  isNative: boolean;
  isPWA: boolean;
  hasEffectiveUpdate: boolean;
  latestVersion?: string;
  lastCheckedAt: Date | null;
}

export function AppVersionInfoBox({
  displayVersion,
  displayBuild,
  platformLabel,
  isNative,
  isPWA,
  hasEffectiveUpdate,
  latestVersion,
  lastCheckedAt,
}: AppVersionInfoBoxProps) {
  return (
    <div className="p-4 rounded-xl bg-surface-raised space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            Versão {displayVersion}
          </span>
          {displayBuild ? (
            <Badge variant="muted" size="xs">
              Build {displayBuild}
            </Badge>
          ) : null}
          <Badge
            variant={isNative ? "portfolio" : isPWA ? "default" : "muted"}
            size="xs"
          >
            {platformLabel}
          </Badge>
        </div>

        <div className="shrink-0">
          {hasEffectiveUpdate ? (
            <div className="flex items-center gap-1.5 text-xs text-warning-strong font-medium">
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>
                {latestVersion ? `v${latestVersion} pronta` : "Nova versão pronta"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-positive-strong font-medium">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              <span>Versão mais recente</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-muted-foreground border-t border-border/80 pt-2.5">
        <span>
          {hasEffectiveUpdate
            ? isNative
              ? "Uma nova versão do instalador Android está pronta para instalação."
              : "Uma nova versão do sistema Web/PWA está pronta para recarregamento."
            : "Você está utilizando a versão estável mais recente do Axir."}
        </span>
        <span className="tabular-nums shrink-0">
          {lastCheckedAt
            ? `Verificado às ${lastCheckedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            : "Checagem automática ativa"}
        </span>
      </div>
    </div>
  );
}
