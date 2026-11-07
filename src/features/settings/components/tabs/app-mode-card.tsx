import { Check, Layers, TrendingUp } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { useAppMode } from "@/state";
import type { AppMode } from "@/types";

export interface AppModeCardProps {
  className?: string;
}

interface AppModeOption {
  id: AppMode;
  title: string;
  badge: string;
  description: string;
  highlights: string[];
}

const APP_MODE_OPTIONS: AppModeOption[] = [
  {
    id: "essential",
    title: "Modo Essencial",
    badge: "Foco no Dia a Dia",
    description:
      "Interface simplificada e despoluída, focada 100% no controle diário de receitas, despesas, cartões e orçamentos.",
    highlights: [
      "Visão Geral limpa e sem distrações",
      "Navegação enxuta com foco operacional",
      "Zero atrito para quem não investe ainda",
    ],
  },
  {
    id: "investor",
    title: "Modo Investidor",
    badge: "Patrimônio Completo",
    description:
      "Experiência completa com motor de rebalanceamento de carteira, acompanhamento de aportes e radar de patrimônio.",
    highlights: [
      "Módulo completo de Investimentos e Metas",
      "Cálculo inteligente de aporte rápido na Home",
      "Leitura de ativos e acompanhamento de rentabilidade",
    ],
  },
];

/**
 * Card de Governança de Perfil de Visualização (§Plano 07).
 *
 * Permite ao usuário alternar a qualquer momento entre Modo Essencial e Modo Investidor
 * com 1 clique reativo, sem necessidade de recarregar a página.
 */
export function AppModeCard({ className }: AppModeCardProps) {
  const { appMode, setAppMode, isUpdating } = useAppMode();

  const handleSelectMode = async (selectedMode: AppMode) => {
    if (selectedMode === appMode || isUpdating) return;
    triggerSensory("action");
    await setAppMode(selectedMode);
  };

  return (
    <Card className={cn(className)} data-tour="settings-app-mode">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Perfil de Visualização do Aplicativo</span>
          </span>
          <Badge
            variant={appMode === "investor" ? "portfolio" : "positive"}
            size="sm"
          >
            {appMode === "investor" ? "Modo Investidor Ativo" : "Modo Essencial Ativo"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Ajuste a complexidade da interface de acordo com o seu momento de vida financeiro.
          Você pode alternar livremente a qualquer momento sem perder nenhum dado.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {APP_MODE_OPTIONS.map((option) => {
            const isSelected = appMode === option.id;
            const Icon = option.id === "investor" ? TrendingUp : Layers;

            return (
              <button
                key={option.id}
                type="button"
                disabled={isUpdating}
                onClick={() => void handleSelectMode(option.id)}
                className={cn(
                  "flex flex-col items-start p-4 rounded-xl border text-left transition-all select-none cursor-pointer relative",
                  isSelected
                    ? option.id === "investor"
                      ? "border-portfolio bg-portfolio/10 ring-2 ring-portfolio/30 shadow-xs"
                      : "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs"
                    : "border-border/80 bg-surface hover:border-border hover:bg-surface-hover/50",
                  isUpdating && "opacity-60 cursor-not-allowed",
                )}
                aria-pressed={isSelected}
              >
                <div className="w-full flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "size-4",
                        isSelected
                          ? option.id === "investor"
                            ? "text-portfolio font-bold"
                            : "text-primary font-bold"
                          : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-foreground">
                      {option.title}
                    </span>
                  </div>
                  {isSelected && (
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full text-white",
                        option.id === "investor" ? "bg-portfolio" : "bg-primary",
                      )}
                      aria-hidden="true"
                    >
                      <Check className="size-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                <Badge
                  variant={isSelected ? (option.id === "investor" ? "portfolio" : "positive") : "muted"}
                  size="xs"
                  className="mb-2"
                >
                  {option.badge}
                </Badge>

                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {option.description}
                </p>

                <ul className="w-full space-y-1 border-t border-border/40 pt-2.5 mt-auto">
                  {option.highlights.map((h, i) => (
                    <li
                      key={i}
                      className="text-[11px] text-muted-foreground flex items-center gap-1.5"
                    >
                      <span
                        className={cn(
                          "size-1 rounded-full shrink-0",
                          isSelected
                            ? option.id === "investor"
                              ? "bg-portfolio"
                              : "bg-primary"
                            : "bg-muted-foreground/40",
                        )}
                        aria-hidden="true"
                      />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
