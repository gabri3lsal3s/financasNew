import { Alert, EmptyState, Skeleton } from "@/components/ui";
import { useAdminFeatures } from "@/state";
import { FeatureToggleCard } from "../components";


export function FeaturesTab() {
  const featuresQuery = useAdminFeatures();
  const features = featuresQuery.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* Alerta Institucional */}
      <Alert variant="info">
        O Kill-Switch desativa a funcionalidade instantaneamente para todos os usuários da plataforma. Para liberar ou bloquear acessos específicos por cliente, utilize a aba Gestão de Usuários.
      </Alert>

      {/* Lista de Features */}
      {featuresQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : features.length === 0 ? (
        <EmptyState
          title="Nenhuma funcionalidade encontrada"
          description="O catálogo de módulos do sistema ainda não foi inicializado no banco."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {features.map((feature) => (
            <FeatureToggleCard key={feature.key} feature={feature} />
          ))}
        </div>
      )}
    </div>
  );
}
