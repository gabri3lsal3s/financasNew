import { Plus, Users } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";

export interface FamilyModeInactiveViewProps {
  isTogglingMode: boolean;
  onActivateMode: () => void;
  onGoHome: () => void;
}

export function FamilyModeInactiveView({
  isTogglingMode,
  onActivateMode,
  onGoHome,
}: FamilyModeInactiveViewProps) {
  return (
    <div className="space-y-6" data-testid="family-mode-inactive">
      <PageHeader
        title="Modo Família"
        description="Acompanhamento colaborativo, fatias de consumo e equilíbrio de contas da casa."
      />

      <EmptyState
        headingLevel="h2"
        tone="default"
        icon={<Users className="size-6" aria-hidden="true" />}
        title="Modo Família desativado"
        description="O Modo Família consolida os gastos da residência, calcula o teto de gastos da casa e realiza acertos justos de contas via Pix, mantendo suas contas e compras pessoais sob total privacidade."
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="default"
              size="default"
              loading={isTogglingMode}
              disabled={isTogglingMode}
              onClick={onActivateMode}
              className="gap-2 shadow-xs"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>{isTogglingMode ? "Ativando..." : "Ativar Modo Família"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onGoHome}
            >
              Voltar ao Início
            </Button>
          </div>
        }
      />
    </div>
  );
}

export interface FamilyEmptySetupViewProps {
  onOpenCreate: () => void;
}

export function FamilyEmptySetupView({ onOpenCreate }: FamilyEmptySetupViewProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Modo Família"
        description="Acompanhamento colaborativo, fatias de consumo e equilíbrio de contas da casa."
      />

      <EmptyState
        headingLevel="h2"
        tone="default"
        icon={<Users className="size-6" aria-hidden="true" />}
        title="Nenhuma família criada ainda"
        description="Crie o seu grupo familiar para acompanhar despesas compartilhadas, definir o teto mensal da casa e fazer acertos justos de contas. Suas contas e despesas pessoais permanecem estritamente privadas."
        action={
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={onOpenCreate}
            className="gap-2 shadow-xs"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Criar Família</span>
          </Button>
        }
      />
    </div>
  );
}
