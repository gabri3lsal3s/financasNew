import { useState } from "react";
import { Briefcase, Building2, Check, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import { BUSINESS_PROFILE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { BusinessProfileKind } from "@/types";

export interface BusinessOnboardingEmptyViewProps {
  isPending?: boolean;
  onActivate: (profileKind: BusinessProfileKind) => Promise<void>;
  onOpenGuide?: () => void;
}

const PROFILE_OPTIONS: Array<{
  kind: BusinessProfileKind;
  title: string;
  description: string;
  icon: typeof Briefcase;
}> = [
  {
    kind: "mei",
    title: BUSINESS_PROFILE_LABELS.mei,
    description: "Inclui Termômetro do Teto Anual e provisão automática do DAS mensal.",
    icon: Briefcase,
  },
  {
    kind: "liberal",
    title: BUSINESS_PROFILE_LABELS.liberal,
    description: "Ideal para psicólogos, autônomos, consultores e especialistas com DRE enxuto.",
    icon: Stethoscope,
  },
  {
    kind: "micro_business",
    title: BUSINESS_PROFILE_LABELS.micro_business,
    description: "Reserva estimada de alíquota sobre faturamento e lucro retido separado.",
    icon: Building2,
  },
];

/** Onboarding opt-in do Modo Negócio exibido em `/negocio` enquanto inativo. */
export function BusinessOnboardingEmptyView({
  isPending = false,
  onActivate,
  onOpenGuide,
}: BusinessOnboardingEmptyViewProps) {
  const [selectedKind, setSelectedKind] = useState<BusinessProfileKind>("mei");

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-portfolio">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span>Separação estrita PF e PJ (Opt-in)</span>
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Ative o Modo Negócio sem poluir suas finanças pessoais
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Acompanhe faturamento, custos operacionais, pró-labore, saldo bancário isolado do negócio
            e escudo fiscal em um só lugar, mantendo sua visão pessoal 100% preservada.
          </p>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          role="radiogroup"
          aria-label="Escolha o perfil do seu negócio"
        >
          {PROFILE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedKind === option.kind;
            return (
              <button
                key={option.kind}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isPending}
                onClick={() => {
                  triggerSensory("selection");
                  setSelectedKind(option.kind);
                }}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-portfolio bg-portfolio/5 shadow-xs"
                    : "border-border/80 bg-surface hover:bg-surface-hover",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 mt-0.5",
                    isSelected ? "text-portfolio" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      {option.title}
                    </span>
                    {isSelected ? (
                      <Check className="size-3.5 shrink-0 text-portfolio" aria-hidden="true" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border/80 pt-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              Você pode ajustar o enquadramento, guia DAS ou desativar o módulo a qualquer momento.
            </p>
            {onOpenGuide ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="gap-1.5 text-xs text-portfolio hover:text-portfolio/80 p-0 h-auto self-start"
                onClick={onOpenGuide}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>Dúvidas sobre seu perfil? Faça o teste guiado</span>
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            disabled={isPending}
            loading={isPending}
            onClick={() => void onActivate(selectedKind)}
            className="gap-1.5 shrink-0"
          >
            <Briefcase className="size-4" aria-hidden="true" />
            <span>Ativar Modo Negócio</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
