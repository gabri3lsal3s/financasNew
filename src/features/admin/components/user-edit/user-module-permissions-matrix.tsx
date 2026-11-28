import { Check, RotateCcw, Sparkles, TrendingUp, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import {
  AI_FEATURE_MODULES,
  BETA_MODULES,
  CORE_MODULES,
  SUBSCRIPTION_STATUS_LABELS,
  type AdminModuleDescriptor,
} from "@/domain/admin";
import type { ModuleAccessLevel, SystemFeature, UserFeatureOverride, UserModulePermission } from "@/types";

const AI_AND_BETA_MODULES = [...BETA_MODULES, ...AI_FEATURE_MODULES];

export interface UserModulePermissionsMatrixProps {
  effectiveSubStatus: string;
  hasAnyModuleOverride: boolean;
  hasCoreOverrides: boolean;
  modulePermissionsMap: Map<string, UserModulePermission>;
  accessSources?: {
    features: SystemFeature[] | undefined;
    overrides: UserFeatureOverride[] | undefined;
  };
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
  accessSources,
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

  const getEffectiveAccess = (module: AdminModuleDescriptor) => {
    const feature = accessSources?.features?.find((item) => item.key === module.key);
    const individualFlag = accessSources?.overrides?.find((item) => item.feature_key === module.key);
    const isAi = module.key === "ai_extraction";
    const individualAiLevel = isAi && individualFlag
      ? individualFlag.is_enabled ? "write" : "none"
      : undefined;
    const override = modulePermissionsMap.get(module.key);
    const category: string = module.category;
    const isExpansion = category === "expansions";
    const inherited = isExpansion && !override
      ? modulePermissionsMap.get("transactions")
      : undefined;
    const moduleOverride = override ?? inherited;
    const isGloballyBlocked = feature?.is_globally_enabled === false;
    const isIndividuallyBlocked = individualFlag?.is_enabled === false;
    const isBeta = module.key === "bank_notification_listener";
    const isDisabledByDefault = isAi && !individualFlag && feature?.default_enabled_for_new_users === false;
    const defaultLevel = isBeta || isDisabledByDefault ? "none" : planDefaultLevel;
    const configuredLevel = individualAiLevel ?? moduleOverride?.access_level;
    const level = isGloballyBlocked || isIndividuallyBlocked ? "none" : configuredLevel ?? defaultLevel;
    const source = isGloballyBlocked
      ? "Kill-Switch Global"
      : accessSources && (!accessSources.features || !accessSources.overrides)
        ? "Origem do acesso indisponível"
        : isIndividuallyBlocked || configuredLevel !== undefined
          ? "Override Individual"
          : "Regra do Plano";

    return { level, source, override, configuredLevel, isBeta, isGloballyBlocked, isIndividuallyBlocked, inherited, isExpansion };
  };

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
            size="xs"
            sensoryIntent={false}
            onClick={onQuickOnlyInvestments}
            disabled={actionsDisabled}
            className="text-portfolio-strong border-portfolio/30 hover:bg-portfolio/10"
            title="Configurar acesso exclusivo a Investimentos"
          >
            <TrendingUp aria-hidden="true" />
            <span>Apenas Investimentos</span>
          </Button>
          {hasAnyModuleOverride && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              sensoryIntent={false}
              onClick={onQuickRestorePlanDefaults}
              disabled={actionsDisabled}
              className="text-muted-foreground hover:text-foreground"
              title="Remover todos os overrides e restaurar o padrão do plano base"
            >
              <RotateCcw aria-hidden="true" />
              <span>Restaurar Padrão do Plano</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>IA &amp; Beta</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Funcionalidades Beta (Acesso Selecionado) exigem concessão individual. A extração por IA também depende da permissão de escrita em Transações.
        </p>

        {AI_AND_BETA_MODULES.map((mod) => {
          const { configuredLevel, level, source, isBeta } = getEffectiveAccess(mod);
          const isGranted = level !== "none";
          const accessLabel = isGranted
            ? "Liberado para este usuário"
            : isBeta && source === "Regra do Plano" ? "Bloqueado (Padrão Beta)" : "Bloqueado";
          return (
            <div key={mod.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-lg border border-border/80 bg-surface text-xs shadow-xs">
              <div className="flex flex-col gap-1 max-w-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{mod.label}</span>
                  <Badge variant={isGranted ? "positive" : "muted"} size="xs">
                    {accessLabel}
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground">{mod.desc}</span>
                <span className="text-[11px] font-medium text-muted-foreground">{source}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-end shrink-0">
                <Button type="button" variant="outline" size="xs" onClick={() => onSetModulePermission(mod.key, "write")} disabled={actionsDisabled} className={configuredLevel && configuredLevel !== "none" ? BTN_STYLES.writeActive : BTN_STYLES.writeIdle}>
                  <Check aria-hidden="true" />
                  <span>Liberado</span>
                </Button>
                <Button type="button" variant="outline" size="xs" onClick={() => onSetModulePermission(mod.key, "none")} disabled={actionsDisabled} className={configuredLevel === "none" ? BTN_STYLES.noneActive : BTN_STYLES.noneIdle}>
                  <X aria-hidden="true" />
                  <span>Bloqueado</span>
                </Button>
                {configuredLevel !== undefined && (
                  <Button type="button" variant="ghost" size="xs" onClick={() => onRemoveModulePermission(mod.key)} disabled={actionsDisabled} className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Restaurar padrão de ${mod.label}`} title="Restaurar padrão da funcionalidade">
                    <RotateCcw aria-hidden="true" />
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

        {hasCoreOverrides && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-warning/30 bg-warning/5 text-xs text-warning-strong">
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              Este usuário possui permissões manuais ativas que sobrepõem as regras automáticas do plano SaaS. Use o botão <strong className="text-foreground">Restaurar Padrão do Plano</strong> caso deseje reconectar o comportamento modular ao status da assinatura.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {CORE_MODULES.map((mod) => {
            const { override, level, source, isGloballyBlocked, isIndividuallyBlocked, inherited, isExpansion } = getEffectiveAccess(mod);
            const configuredLevel = override?.access_level ?? inherited?.access_level ?? planDefaultLevel;
            const badgeVariant = level === "none" ? "critical" : level === "read" ? "warning" : "positive";
            const levelLabel = level === "none" ? "Bloqueado" : level === "read" ? "Somente Leitura" : "Acesso Total";
            const badgeLabel = override || inherited
              ? isGloballyBlocked || isIndividuallyBlocked ? levelLabel : `Override: ${levelLabel}`
              : isExpansion || isGloballyBlocked || isIndividuallyBlocked
                ? levelLabel
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
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {source}{!override && inherited && source === "Override Individual" ? " de Transações" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-end sm:justify-start shrink-0 pt-1 sm:pt-0">
                  <Button type="button" variant="outline" size="xs" onClick={() => onSetModulePermission(mod.key, "write")} disabled={actionsDisabled} className={`px-2 flex-1 sm:flex-initial justify-center ${configuredLevel === "write" ? BTN_STYLES.writeActive : BTN_STYLES.writeIdle}`} title="Liberar escrita e leitura neste módulo">
                    <Check aria-hidden="true" />
                    <span>Total</span>
                  </Button>
                  <Button type="button" variant="outline" size="xs" onClick={() => onSetModulePermission(mod.key, "read")} disabled={actionsDisabled} className={`px-2 flex-1 sm:flex-initial justify-center ${configuredLevel === "read" ? BTN_STYLES.readActive : BTN_STYLES.readIdle}`} title="Restringir a somente leitura neste módulo">
                    <span>Leitura</span>
                  </Button>
                  <Button type="button" variant="outline" size="xs" onClick={() => onSetModulePermission(mod.key, "none")} disabled={actionsDisabled} className={`px-2 flex-1 sm:flex-initial justify-center ${configuredLevel === "none" ? BTN_STYLES.noneActive : BTN_STYLES.noneIdle}`} title="Bloquear completamente o módulo para este usuário">
                    <X aria-hidden="true" />
                    <span>Bloquear</span>
                  </Button>
                  {override && (
                    <Button type="button" variant="ghost" size="xs" onClick={() => onRemoveModulePermission(mod.key)} disabled={actionsDisabled} className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Restaurar regra padrão de ${mod.label}`} title="Restaurar regra padrão do plano">
                      <RotateCcw aria-hidden="true" />
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
