import { useId, useState } from "react";
import { Check, Layers, ShieldAlert } from "lucide-react";
import { Badge, Button, ConfirmDialog, ContentLoading, FormField, Input } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { useAdminGlobalFeatureImpact, useAdminToggleGlobalFeature } from "@/state/mutations/use-admin-mutations";
import type { SystemFeature } from "@/types";

export interface FeatureToggleCardProps {
  feature: SystemFeature;
}

export function FeatureToggleCard({ feature }: FeatureToggleCardProps) {
  const reasonId = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const toggleMutation = useAdminToggleGlobalFeature();
  const impactQuery = useAdminGlobalFeatureImpact(feature.key, confirmOpen);
  const impact = impactQuery.data;

  const handleConfirmOpenChange = (open: boolean) => {
    setConfirmOpen(open);
    setReason("");
    setReasonError(undefined);
  };

  const handleToggle = () => {
    if (feature.is_globally_enabled) {
      handleConfirmOpenChange(true);
      return;
    }

    toggleMutation.mutate({ featureKey: feature.key, enabled: true });
  };

  const handleDisable = () => {
    if (!feature.is_globally_enabled || impactQuery.isFetching || impactQuery.isError || impact === undefined) return;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setReasonError("Informe o motivo da desativação.");
      return;
    }

    toggleMutation.mutate(
      { featureKey: feature.key, enabled: false, reason: trimmedReason },
      { onSuccess: () => handleConfirmOpenChange(false) },
    );
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl border border-border/80 bg-surface shadow-xs">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {feature.is_globally_enabled ? (
          <Layers className="size-4 text-positive-strong shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-4 text-critical-strong shrink-0 mt-0.5" aria-hidden="true" />
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
        sensoryIntent={feature.is_globally_enabled ? false : undefined}
        onClick={handleToggle}
        loading={toggleMutation.isPending && !confirmOpen}
        className="w-full sm:w-auto justify-center shrink-0"
      >
        {feature.is_globally_enabled ? (
          <>
            <ShieldAlert aria-hidden="true" />
            <span>Desativar Módulo</span>
          </>
        ) : (
          <>
            <Check aria-hidden="true" />
            <span>Ativar Módulo</span>
          </>
        )}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={handleConfirmOpenChange}
        title="Desativar módulo globalmente"
        description={`O Kill-Switch suspende o acesso a ${feature.name}.`}
        confirmLabel="Desativar módulo"
        variant="destructive"
        confirmPending={toggleMutation.isPending}
        onConfirm={handleDisable}
      >
        <div className="space-y-3">
          {impactQuery.isFetching ? (
            <ContentLoading />
          ) : impactQuery.isError ? (
            <div role="alert" className="space-y-2 text-sm text-critical-strong">
              <p>{getErrorMessage(impactQuery.error)}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void impactQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : impact ? (
            <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <dt>Contas ativas na plataforma</dt>
                <dd className="text-base font-semibold tabular-nums text-foreground">{impact.active_users_total.toLocaleString("pt-BR")}</dd>
              </div>
              <div>
                <dt>Usuários com overrides no módulo</dt>
                <dd className="text-base font-semibold tabular-nums text-foreground">{impact.explicit_overrides_count.toLocaleString("pt-BR")}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              A estimativa de impacto está indisponível neste ambiente.
            </p>
          )}

          <FormField htmlFor={reasonId} label="Motivo da desativação" required error={reasonError}>
            <Input
              id={reasonId}
              value={reason}
              maxLength={200}
              required
              disabled={toggleMutation.isPending}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? `${reasonId}-error` : undefined}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(undefined);
              }}
            />
          </FormField>
        </div>
      </ConfirmDialog>
    </div>
  );
}
