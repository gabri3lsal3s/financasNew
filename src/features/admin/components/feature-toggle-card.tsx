import { Check, Layers, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { useAdminToggleGlobalFeature } from "@/state";
import type { SystemFeature } from "@/types";

export interface FeatureToggleCardProps {
  feature: SystemFeature;
}

export function FeatureToggleCard({ feature }: FeatureToggleCardProps) {
  const toggleMutation = useAdminToggleGlobalFeature();

  const handleToggle = () => {
    toggleMutation.mutate({
      featureKey: feature.key,
      enabled: !feature.is_globally_enabled,
    });
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface/90 shadow-xs transition-all hover:border-border">
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl border mt-0.5 sm:mt-0 ${
            feature.is_globally_enabled
              ? "bg-positive/10 border-positive/20 text-positive-strong"
              : "bg-critical/10 border-critical/20 text-critical"
          }`}
          aria-hidden="true"
        >
          {feature.is_globally_enabled ? (
            <Layers className="size-5" aria-hidden="true" />
          ) : (
            <ShieldAlert className="size-5" aria-hidden="true" />
          )}
        </span>

        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-sm">{feature.name}</span>
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                feature.is_globally_enabled
                  ? "bg-positive/10 text-positive-strong border border-positive/20"
                  : "bg-critical/10 text-critical border border-critical/20"
              }`}
            >
              {feature.is_globally_enabled ? "Ativo Globalmente" : "Desativado (Kill-Switch)"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
        </div>
      </div>

      <Button
        type="button"
        variant={feature.is_globally_enabled ? "destructive" : "default"}
        size="sm"
        onClick={handleToggle}
        disabled={toggleMutation.isPending}
        className="w-full sm:w-auto justify-center shrink-0 gap-1.5 h-9 text-xs px-3"
      >
        {feature.is_globally_enabled ? (
          <>
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            Desativar Módulo
          </>
        ) : (
          <>
            <Check className="size-3.5" aria-hidden="true" />
            Ativar Módulo
          </>
        )}
      </Button>
    </div>
  );
}

