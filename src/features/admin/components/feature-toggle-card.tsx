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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl border border-border/80 bg-surface shadow-xs transition-all hover:border-border">
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
            <Badge
              variant={feature.is_globally_enabled ? "positive" : "critical"}
              size="xs"
            >
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

