import { Crown, Sparkles } from "lucide-react";
import { Badge, Button, FormField, Select } from "@/components/ui";
import type { SubscriptionTier } from "@/types";

export interface UserSaasPlanSectionProps {
  currentTier: SubscriptionTier | string | undefined;
  effectiveTier: SubscriptionTier;
  effectiveSubStatus: string;
  isSaving: boolean;
  onTierChange: (tier: SubscriptionTier, planId: string) => void;
  onSubStatusChange: (status: string) => void;
  onSaveSubscription: () => void;
}

function mapTierToPlanId(tier: SubscriptionTier): string {
  if (tier === "lifetime") return "lifetime";
  if (tier === "pro_monthly") return "pro_monthly";
  if (tier === "pro_annual") return "pro_annual";
  return "trial";
}

/**
 * Seção de gestão do plano SaaS e status de assinatura do usuário.
 */
export function UserSaasPlanSection({
  currentTier,
  effectiveTier,
  effectiveSubStatus,
  isSaving,
  onTierChange,
  onSubStatusChange,
  onSaveSubscription,
}: UserSaasPlanSectionProps) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/80 bg-surface shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crown className="size-4 text-portfolio" aria-hidden="true" />
          <span className="text-xs font-bold text-foreground">Plano SaaS &amp; Assinatura</span>
        </div>
        {currentTier === "lifetime" ? (
          <Badge variant="portfolio" size="xs" className="gap-1 self-start sm:self-auto">
            <Sparkles className="size-3" aria-hidden="true" />
            Vitalício VIP
          </Badge>
        ) : (
          <Badge variant="muted" size="xs" className="self-start sm:self-auto">
            Tier: {currentTier || "trial"}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <FormField label="Tier de Assinatura" htmlFor="target-tier">
          <Select
            id="target-tier"
            value={effectiveTier}
            onValueChange={(val) => {
              const newTier = val as SubscriptionTier;
              onTierChange(newTier, mapTierToPlanId(newTier));
            }}
            options={[
              { value: "trial", label: "Trial Pro (Período de Teste)" },
              { value: "lifetime", label: "Plano Vitalício VIP" },
              { value: "pro_annual", label: "Pro Anual" },
              { value: "pro_monthly", label: "Pro Mensal" },
              { value: "read_only", label: "Somente Leitura (Expirado)" },
            ]}
          />
        </FormField>

        <FormField label="Status da Assinatura" htmlFor="target-sub-status">
          <Select
            id="target-sub-status"
            value={effectiveSubStatus}
            onValueChange={onSubStatusChange}
            options={[
              { value: "active", label: "Ativa (active)" },
              { value: "trialing", label: "Em Teste (trialing)" },
              { value: "past_due", label: "Inadimplente (past_due)" },
              { value: "canceled", label: "Cancelada (canceled)" },
              { value: "read_only_expired", label: "Modo Leitura (read_only_expired)" },
            ]}
          />
        </FormField>
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-border/80">
        <Button
          type="button"
          variant="default"
          size="sm"
          sensoryIntent={false}
          onClick={onSaveSubscription}
          disabled={isSaving}
          className="gap-1.5 text-xs h-8 px-3"
        >
          <Crown className="size-3.5" aria-hidden="true" />
          <span>{isSaving ? "Salvando…" : "Atualizar Plano / Tier"}</span>
        </Button>
      </div>
    </div>
  );
}
