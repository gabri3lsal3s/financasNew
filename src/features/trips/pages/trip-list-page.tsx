/**
 * Página principal do Hub de Viagens (/viagens).
 * Lista viagens ativas e histórico de viagens concluídas.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plane, Plus, Calendar, MapPin, ArrowRight } from "lucide-react";
import {
  Button,
  Badge,
  Card,
  Tabs,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { useUserTrips } from "@/state/queries/use-trips";
import { useTripMode } from "@/state";
import { useAuth } from "@/hooks/use-auth";
import { CreateTripDialog } from "../components";

export function TripListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isTripModeEnabled, toggleTripMode, isPending: isTogglingTripMode } = useTripMode();
  const { data: trips, isLoading } = useUserTrips();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("active");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isTripModeEnabled) {
    return (
      <div className="space-y-6" data-testid="trip-mode-inactive">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <Plane className="size-5 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Modo Viagem
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Grupos temporários de despesas compartilhadas com compensação líquida e acerto Pix.
          </p>
        </header>

        <Card className="border-border/80 bg-surface shadow-xs p-6 sm:p-10 rounded-2xl text-center">
          <EmptyState
            icon={<Plane className="size-10 text-muted-foreground" aria-hidden="true" />}
            title="Modo Viagem desativado"
            description="O Modo Viagem permite criar grupos temporários de despesas para viagens com amigos, simplifica acertos pelo algoritmo de menor esforço e gera links de colaboração sem exigir cadastro dos convidados."
            action={
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isTogglingTripMode}
                  onClick={() => toggleTripMode(true)}
                  className="gap-2 rounded-xl cursor-pointer"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  <span>{isTogglingTripMode ? "Ativando..." : "Ativar Modo Viagem"}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/")}
                  className="rounded-xl cursor-pointer"
                >
                  Voltar ao Início
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  const activeTrips = (trips ?? []).filter(
    (t) => t.status === "active" || t.status === "planning" || t.status === "settling"
  );
  const archivedTrips = (trips ?? []).filter(
    (t) => t.status === "completed" || t.status === "archived"
  );

  const renderTripCard = (trip: (typeof activeTrips)[0]) => {
    const isHost = trip.host_user_id === user?.id;

    return (
      <Card
        key={trip.id}
        className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface shadow-xs hover:border-border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
              {trip.title}
            </h2>
            {isHost ? (
              <Badge size="xs" variant="default">
                Organizador
              </Badge>
            ) : (
              <Badge size="xs" variant="positive">
                Participante
              </Badge>
            )}
            <Badge
              size="xs"
              variant={
                trip.status === "completed"
                  ? "positive"
                  : trip.status === "settling"
                  ? "warning"
                  : "muted"
              }
            >
              {trip.status === "completed"
                ? "Finalizada"
                : trip.status === "settling"
                ? "Em Acerto"
                : "Ativa"}
            </Badge>
          </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {trip.destination && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {trip.destination}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {trip.start_date} até {trip.end_date}
          </span>
        </div>
      </div>

      <Link to={`/viagens/${trip.id}`} className="self-stretch sm:self-auto shrink-0">
        <Button size="sm" variant="outline" className="w-full sm:w-auto text-xs gap-1.5 h-8">
          Acessar Detalhes
          <ArrowRight className="size-3" aria-hidden="true" />
        </Button>
      </Link>
    </Card>
  );
};

  const tabItems = [
    {
      value: "active",
      label: `Viagens Ativas (${activeTrips.length})`,
      content: (
        <div className="space-y-3 mt-3">
          {activeTrips.length === 0 ? (
            <Card className="p-8 border-border/80 bg-surface text-center">
              <EmptyState
                icon={<Plane className="size-8" />}
                title="Nenhuma viagem em andamento"
                description="Crie um novo grupo de viagem para dividir despesas em conjunto."
                action={
                  <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5 text-xs">
                    <Plus className="size-3.5" aria-hidden="true" />
                    Criar Primeira Viagem
                  </Button>
                }
              />
            </Card>
          ) : (
            activeTrips.map(renderTripCard)
          )}
        </div>
      ),
    },
    {
      value: "archived",
      label: `Histórico / Finalizadas (${archivedTrips.length})`,
      content: (
        <div className="space-y-3 mt-3">
          {archivedTrips.length === 0 ? (
            <Card className="p-8 border-border/80 bg-surface text-center">
              <EmptyState
                icon={<Plane className="size-8" />}
                title="Nenhuma viagem finalizada"
                description="Viagens com contas concluídas e arquivadas aparecerão aqui para consulta histórica."
              />
            </Card>
          ) : (
            archivedTrips.map(renderTripCard)
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6" data-tour="trips-hub">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Plane className="size-5 text-muted-foreground" aria-hidden="true" />
            Modo Viagem
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Grupos temporários de despesas compartilhadas com compensação líquida e acerto Pix.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5 text-xs self-start sm:self-auto h-9"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Nova Viagem
        </Button>
      </div>

      {/* Abas */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        items={tabItems}
        variant="pills"
        fullWidth
      />

      <CreateTripDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={(newId) => navigate(`/viagens/${newId}`)}
      />
    </div>
  );
}
