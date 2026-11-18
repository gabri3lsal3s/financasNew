import { Check, Layers, ShieldAlert } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useAdminToggleGlobalFeature } from "@/state";
import type { SystemFeature } from "@/types";

export interface FeatureToggleCardProps {
  feature: SystemFeature;
}

export function FeatureToggleCard({ feature }: FeatureToggleCardProps) {
  const toggleMutation = useAdminToggleGlobalFeature();

  const handleToggle = () => {
    const nextState = !feature.is_globally_enabled;
    toggleMutation.mutate(
      {
        featureKey: feature.key,
        enabled: nextState,
      },
      {
        onSuccess: () => {
          triggerSensory(nextState ? "success" : "destructive");
          pushToast({
            title: nextState ? "Módulo ativado globalmente" : "Módulo desativado via Kill-Switch",
            description: `${feature.name} agora está ${nextState ? "disponível" : "bloqueado"} na plataforma.`,
            variant: nextState ? "default" : "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl border border-border/80 bg-surface shadow-xs">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {feature.is_globally_enabled ? (
          <Layers className="size-4.5 text-positive-strong shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-4.5 text-critical-strong shrink-0 mt-0.5" aria-hidden="true" />
        )}

        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-sm">{feature.name}</span>
            <Badge variant={feature.is_globally_enabled ? "positive" : "critical"} size="xs">
              {feature.is_globally_enabled ? "Ativo Globalmente" : "Desativado (Kill-Switch)"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
        </div>
      </div>

      <Button
        type="button"
        variant={feature.is_globally_enabled ? "destructive" : "default"}
        size="sm"
        sensoryIntent={false}
        onClick={handleToggle}
        disabled={toggleMutation.isPending}
        className="w-full sm:w-auto justify-center shrink-0 gap-1.5 text-xs px-3"
      >
        {feature.is_globally_enabled ? (
          <>
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            <span>Desativar Módulo</span>
          </>
        ) : (
          <>
            <Check className="size-3.5" aria-hidden="true" />
            <span>Ativar Módulo</span>
          </>
        )}
      </Button>
    </div>
  );
}
