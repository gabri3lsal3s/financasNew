import { Check, ShieldAlert } from "lucide-react";
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border/80 bg-surface/90 shadow-xs">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
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
        <p className="text-xs text-muted-foreground">{feature.description}</p>
      </div>

      <Button
        type="button"
        variant={feature.is_globally_enabled ? "destructive" : "default"}
        size="sm"
        onClick={handleToggle}
        disabled={toggleMutation.isPending}
        className="shrink-0 gap-1.5"
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
