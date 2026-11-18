import { Check, RotateCcw, Sparkles, TrendingUp, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { ModuleAccessLevel, UserModulePermission } from "@/types";
import { BETA_MODULES, CORE_MODULES, SUBSCRIPTION_STATUS_LABELS } from "./admin-module-catalog";

export interface UserModulePermissionsMatrixProps {
  effectiveSubStatus: string;
  hasAnyModuleOverride: boolean;
  hasCoreOverrides: boolean;
  modulePermissionsMap: Map<string, UserModulePermission>;
  isQuickActionPending: boolean;
  isMutating: boolean;
  onSetModulePermission: (moduleKey: string, level: ModuleAccessLevel) => void;
  onRemoveModulePermission: (moduleKey: string) => void;
  onQuickOnlyInvestments: () => void;
  onQuickRestorePlanDefaults: () => void;
}

const BTN_STYLES = {
  writeActive: "bg-positive/15 text-positive-strong border-positive/40 hover:bg-positive/20",
  writeIdle: "text-positive-strong hover:bg-positive/10 border-positive/30",
  readActive: "bg-warning/15 text-warning-strong border-warning/40 hover:bg-warning/20",
  readIdle: "text-warning-strong hover:bg-warning/10 border-warning/30",
  noneActive: "bg-critical/15 text-critical-strong border-critical/40 hover:bg-critical/20",
  noneIdle: "text-critical-strong hover:bg-critical/10 border-critical/30",
};

/** Matriz de permissões modulares granulares (Beta e Plano Base) com presets rápidos. */
export function UserModulePermissionsMatrix({
  effectiveSubStatus,
  hasAnyModuleOverride,
  hasCoreOverrides,
  modulePermissionsMap,
  isQuickActionPending,
  isMutating,
  onSetModulePermission,
  onRemoveModulePermission,
  onQuickOnlyInvestments,
  onQuickRestorePlanDefaults,
}: UserModulePermissionsMatrixProps) {
  const isPlanActive = effectiveSubStatus === "active" || effectiveSubStatus === "trialing";
  const planDefaultLevel: ModuleAccessLevel = isPlanActive ? "write" : "read";
  const planStatusLabel = SUBSCRIPTION_STATUS_LABELS[effectiveSubStatus] ?? effectiveSubStatus;
  const actionsDisabled = isQuickActionPending || isMutating;

  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-border/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-foreground">Permissões Modulares Granulares</span>
          <span className="text-[11px] text-muted-foreground">
            Módulos do plano base derivam permissões automaticamente do plano selecionado. Funcionalidades beta são concedidas seletivamente.
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            sensoryIntent={false}
            onClick={onQuickOnlyInvestments}
            disabled={actionsDisabled}
            className="gap-1.5 text-xs h-7 px-2.5 text-portfolio-strong border-portfolio/30 hover:bg-portfolio/10"
            title="Configurar acesso exclusivo a Investimentos"
          >
            <TrendingUp className="size-3.5" aria-hidden="true" />
            <span>Apenas Investimentos</span>
          </Button>
          {hasAnyModuleOverride && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent={false}
              onClick={onQuickRestorePlanDefaults}
              disabled={actionsDisabled}
              className="gap-1.5 text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground"
              title="Remover todos os overrides e restaurar o padrão do plano base"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Restaurar Padrão do Plano</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-primary-strong">
          <Sparkles className="size-3.5 text-primary-strong" aria-hidden="true" />
          <span>Funcionalidades Beta (Acesso Selecionado)</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Recursos em estágio experimental. O acesso permanece restrito exclusivamente a usuários selecionados com concessão individual do Superadmin.
        </p>

        {BETA_MODULES.map((mod) => {
          const override = modulePermissionsMap.get(mod.key);
          const hasOverride = Boolean(override);
          const isGranted = override?.access_level === "write" || override?.access_level === "admin";
          return (
            <div key={mod.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-lg border border-border/80 bg-surface text-xs shadow-xs">
              <div className="flex flex-col gap-1 max-w-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{mod.label}</span>
                  <Badge variant={isGranted ? "positive" : "muted"} size="xs">
                    {isGranted ? "Liberado para este usuário" : "Bloqueado (Padrão Beta)"}
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground">{mod.desc}</span>
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end shrink-0">
                <Button type="button" variant="outline" size="sm" onClick={() => onSetModulePermission(mod.key, "write")} disabled={isMutating} className={`gap-1 text-xs h-7 px-2.5 ${isGranted ? BTN_STYLES.writeActive : BTN_STYLES.writeIdle}`}>
                  <Check className="size-3.5" aria-hidden="true" />
                  <span>Liberado</span>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onSetModulePermission(mod.key, "none")} disabled={isMutating} className={`gap-1 text-xs h-7 px-2.5 ${!isGranted && hasOverride ? BTN_STYLES.noneActive : BTN_STYLES.noneIdle}`}>
                  <X className="size-3.5" aria-hidden="true" />
                  <span>Bloqueado</span>
                </Button>
                {hasOverride && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveModulePermission(mod.key)} disabled={isMutating} className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Restaurar padrão de ${mod.label}`} title="Restaurar padrão da funcionalidade">
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Módulos do Plano Base</span>
            {hasCoreOverrides && <Badge variant="warning" size="xs">Com Overrides Manuais</Badge>}
          </div>
          <span className="text-[11px] text-muted-foreground">
            Respondendo dinamicamente ao status: <strong className="text-foreground">{planStatusLabel}</strong>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {CORE_MODULES.map((mod) => {
            const override = modulePermissionsMap.get(mod.key);
            const hasOverride = Boolean(override);
            const level = override?.access_level ?? planDefaultLevel;
            const badgeVariant = hasOverride ? (level === "write" || level === "admin" ? "positive" : level === "read" ? "warning" : "critical") : isPlanActive ? "positive" : "warning";
            const badgeLabel = hasOverride
              ? `Override: ${level === "write" || level === "admin" ? "Acesso Total" : level === "read" ? "Somente Leitura" : "Bloqueado"}`
              : isPlanActive
                ? "Acesso Total (Plano Ativo)"
                : `Somente Leitura (${planStatusLabel})`;

            return (
              <div key={mod.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-border/80 bg-surface text-xs shadow-xs">
                <div className="flex flex-col gap-1 max-w-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{mod.label}</span>
                    <Badge variant={badgeVariant} size="xs">{badgeLabel}</Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{mod.desc}</span>
                </div>
                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end sm:justify-start shrink-0 pt-1 sm:pt-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => onSetModulePermission(mod.key, "write")} disabled={isMutating} className={`gap-1 text-xs h-7 px-2 flex-1 sm:flex-initial justify-center ${level === "write" ? BTN_STYLES.writeActive : BTN_STYLES.writeIdle}`} title="Liberar escrita e leitura neste módulo">
                    <Check className="size-3.5" aria-hidden="true" />
                    <span>Total</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onSetModulePermission(mod.key, "read")} disabled={isMutating} className={`gap-1 text-xs h-7 px-2 flex-1 sm:flex-initial justify-center ${level === "read" ? BTN_STYLES.readActive : BTN_STYLES.readIdle}`} title="Restringir a somente leitura neste módulo">
                    <span>Leitura</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onSetModulePermission(mod.key, "none")} disabled={isMutating} className={`gap-1 text-xs h-7 px-2 flex-1 sm:flex-initial justify-center ${level === "none" ? BTN_STYLES.noneActive : BTN_STYLES.noneIdle}`} title="Bloquear completamente o módulo para este usuário">
                    <X className="size-3.5" aria-hidden="true" />
                    <span>Bloquear</span>
                  </Button>
                  {hasOverride && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveModulePermission(mod.key)} disabled={isMutating} className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Restaurar regra padrão de ${mod.label}`} title="Restaurar regra padrão do plano">
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
