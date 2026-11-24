import { useNavigate } from "react-router";
import { Plus, Receipt } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";

export interface TripDetailsModeInactiveViewProps {
  isTogglingTripMode: boolean;
  onActivateMode: () => void;
}

export function TripDetailsModeInactiveView({
  isTogglingTripMode,
  onActivateMode,
}: TripDetailsModeInactiveViewProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6" data-testid="trip-mode-inactive">
      <PageHeader
        title="Modo Viagem"
        description="Despesas compartilhadas e acerto entre participantes"
      />

      <EmptyState
        headingLevel="h2"
        tone="default"
        icon={<Receipt className="size-6" aria-hidden="true" />}
        title="Modo Viagem desativado"
        description="Ative o Modo Viagem para acessar os detalhes, balanços e acertos desta viagem. Seus dados continuam salvos com segurança."
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto">
            <Button
              type="button"
              size="default"
              loading={isTogglingTripMode}
              disabled={isTogglingTripMode}
              onClick={onActivateMode}
              className="gap-2 shadow-xs"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>{isTogglingTripMode ? "Ativando..." : "Ativar Modo Viagem"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => navigate("/viagens")}
            >
              Voltar para Viagens
            </Button>
          </div>
        }
      />
    </div>
  );
}

export function TripDetailsNotFoundView() {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto pt-10">
      <EmptyState
        headingLevel="h2"
        tone="default"
        icon={<Receipt className="size-6" aria-hidden="true" />}
        title="Viagem não encontrada"
        description="A viagem pode ter sido excluída ou você não possui permissão para acessá-la."
        action={
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => navigate("/viagens")}
          >
            Voltar para Viagens
          </Button>
        }
      />
    </div>
  );
}
