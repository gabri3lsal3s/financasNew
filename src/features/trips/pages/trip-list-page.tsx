/**
 * Página principal do Hub de Viagens (/viagens).
 * Lista viagens ativas e histórico de viagens concluídas.
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { Archive, Compass, Plane, Plus } from "lucide-react";
import {
  Button,
  EmptyState,
  Tabs,
  TripsSkeleton,
} from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { startDemo } from "@/state/demo-mode";
import { useUserTrips } from "@/state/queries/use-trips";
import { useTripMode } from "@/state";
import { useAuth } from "@/hooks/use-auth";
import { CreateTripDialog } from "../components";
import { TripListCard } from "../components/trip-list-card";

export function TripListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isTripModeEnabled, toggleTripMode, isPending: isTogglingTripMode } = useTripMode();
  const { data: trips, isLoading } = useUserTrips();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("active");

  if (isLoading) {
    return <TripsSkeleton />;
  }

  if (!isTripModeEnabled) {
    return (
      <div className="space-y-6" data-testid="trip-mode-inactive">
        <PageHeader
          title="Modo Viagem"
          description="Grupos temporários de despesas compartilhadas com compensação líquida e acerto Pix."
        />

        <EmptyState
          headingLevel="h2"
          tone="default"
          icon={<Plane className="size-6" aria-hidden="true" />}
          title="Modo Viagem desativado"
          description="O Modo Viagem permite criar grupos temporários de despesas para viagens com amigos, simplifica acertos pelo algoritmo de menor esforço e gera links de colaboração sem exigir cadastro dos convidados."
          action={
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                size="default"
                loading={isTogglingTripMode}
                disabled={isTogglingTripMode}
                onClick={() => toggleTripMode(true)}
                className="gap-2 shadow-xs"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span>{isTogglingTripMode ? "Ativando..." : "Ativar Modo Viagem"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => navigate("/")}
              >
                Voltar ao Início
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const activeTrips = (trips ?? []).filter(
    (t) => t.status === "active" || t.status === "planning" || t.status === "settling",
  );
  const archivedTrips = (trips ?? []).filter(
    (t) => t.status === "completed" || t.status === "archived",
  );

  const tabItems = [
    {
      value: "active",
      label: `Viagens Ativas (${activeTrips.length})`,
      icon: <Plane className="size-4" aria-hidden="true" />,
      content: (
        <div className="space-y-3">
          {activeTrips.length === 0 ? (
            <EmptyState
              headingLevel="h2"
              tone="default"
              icon={<Plane className="size-6" aria-hidden="true" />}
              title="Nenhuma viagem em andamento"
              description="Crie um novo grupo de viagem para dividir despesas em conjunto."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="default"
                    onClick={() => setIsCreateOpen(true)}
                    className="gap-1.5 shadow-xs"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    <span>Criar Primeira Viagem</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={() => startDemo("finances_trips")}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Compass className="size-4" aria-hidden="true" />
                    <span>Ver exemplo na Simulação</span>
                  </Button>
                </div>
              }
            />
          ) : (
            activeTrips.map((trip) => (
              <TripListCard
                key={trip.id}
                trip={trip}
                isHost={trip.host_user_id === user?.id}
              />
            ))
          )}
        </div>
      ),
    },
    {
      value: "archived",
      label: `Histórico / Finalizadas (${archivedTrips.length})`,
      shortLabel: `Finalizadas (${archivedTrips.length})`,
      icon: <Archive className="size-4" aria-hidden="true" />,
      content: (
        <div className="space-y-3">
          {archivedTrips.length === 0 ? (
            <EmptyState
              headingLevel="h2"
              tone="default"
              icon={<Archive className="size-6" aria-hidden="true" />}
              title="Nenhuma viagem finalizada"
              description="Viagens com contas concluídas e arquivadas aparecerão aqui para consulta histórica."
            />
          ) : (
            archivedTrips.map((trip) => (
              <TripListCard
                key={trip.id}
                trip={trip}
                isHost={trip.host_user_id === user?.id}
              />
            ))
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6" data-tour="trips-hub">
      <PageHeader
        title="Modo Viagem"
        description="Grupos temporários de despesas compartilhadas com compensação líquida e acerto Pix."
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 w-full sm:w-auto min-h-11 sm:min-h-8 shadow-xs"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Nova Viagem</span>
          </Button>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        items={tabItems}
        variant="underline"
        swipeable
      />

      <CreateTripDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={(newId) => navigate(`/viagens/${newId}`)}
      />
    </div>
  );
}
