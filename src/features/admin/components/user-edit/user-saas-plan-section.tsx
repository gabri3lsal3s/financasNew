import { Crown, Sparkles } from "lucide-react";
import { Badge, Button, DatePicker, FormField, Select } from "@/components/ui";
import type { SubscriptionTier } from "@/types";

export interface UserSaasPlanSectionProps {
  currentTier: SubscriptionTier | string | undefined;
  effectiveTier: SubscriptionTier;
  effectiveSubStatus: string;
  isSaving: boolean;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  effectiveTrialEndsAt?: string;
  effectivePeriodEnd?: string;
  cardLast4?: string | null;
  asaasSubscriptionId?: string | null;
  onTierChange: (tier: SubscriptionTier, planId: string) => void;
  onSubStatusChange: (status: string) => void;
  onTrialEndsAtChange?: (date: string) => void;
  onPeriodEndChange?: (date: string) => void;
  onSaveSubscription: () => void;
}

function mapTierToPlanId(tier: SubscriptionTier): string {
  if (tier === "lifetime") return "lifetime";
  if (tier === "pro_monthly") return "pro_monthly";
  if (tier === "pro_annual") return "pro_annual";
  return "trial";
}

/**
 * Seção de gestão do plano SaaS, status de assinatura e datas de vigência do usuário.
 */
export function UserSaasPlanSection({
  currentTier,
  effectiveTier,
  effectiveSubStatus,
  isSaving,
  currentPeriodEnd,
  trialEndsAt,
  effectiveTrialEndsAt,
  effectivePeriodEnd,
  cardLast4,
  asaasSubscriptionId,
  onTierChange,
  onSubStatusChange,
  onTrialEndsAtChange,
  onPeriodEndChange,
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

      {(currentPeriodEnd || trialEndsAt || cardLast4 || asaasSubscriptionId) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg bg-surface-raised/60 text-[11px] text-muted-foreground border border-border/80">
          <div>
            <span className="font-semibold text-foreground block">Vencimento / Vigência</span>
            <span>
              {currentPeriodEnd
                ? new Date(currentPeriodEnd).toLocaleDateString("pt-BR")
                : trialEndsAt
                  ? `Trial até ${new Date(trialEndsAt).toLocaleDateString("pt-BR")}`
                  : "Sem data definida"}
            </span>
          </div>
          <div>
            <span className="font-semibold text-foreground block">Gateway &amp; Cartão</span>
            <span>
              {cardLast4 ? `Cartão final ${cardLast4}` : "Sem cartão"} · {asaasSubscriptionId ? "Asaas Ativo" : "Avulso/Direto"}
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
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

        <FormField label="Fim do Trial" optional htmlFor="target-trial-ends">
          <DatePicker
            id="target-trial-ends"
            value={effectiveTrialEndsAt ?? ""}
            onValueChange={(val) => onTrialEndsAtChange?.(val)}
            placeholder="Sem data de trial"
            ariaLabel="Fim do Trial"
          />
        </FormField>

        <FormField label="Vigência do Período" optional htmlFor="target-period-end">
          <DatePicker
            id="target-period-end"
            value={effectivePeriodEnd ?? ""}
            onValueChange={(val) => onPeriodEndChange?.(val)}
            placeholder="Sem data de vigência"
            ariaLabel="Vigência do Período"
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
        >
          <Crown aria-hidden="true" />
          <span>{isSaving ? "Salvando…" : "Atualizar Plano / Tier"}</span>
        </Button>
      </div>
    </div>
  );
}
