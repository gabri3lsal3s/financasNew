import { Navigate } from "react-router";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFamilyMode, useMyFamily } from "@/state";

/**
 * Hub de Gestão e Orçamento Familiar (/familia).
 * Exibe a consolidação de gastos da casa, equilíbrio entre participantes e acertos Pix.
 * Acesso condicional restrito a participantes de uma família ativa (§F1–F5).
 */
export function FamilyPage() {
  const { data: myFamilyData, isLoading: isFamilyLoading } = useMyFamily();
  const { isFamilyModeEnabled, isLoading: isModeLoading } = useFamilyMode();

  const isLoading = isFamilyLoading || isModeLoading;
  const isFamilyActive = Boolean(myFamilyData?.family || isFamilyModeEnabled);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" data-testid="family-page-skeleton">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isFamilyActive) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Users className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Orçamento Familiar
          </h1>
        </div>
      </header>

      {/* Container base estrutural — enriquecido com cards analíticos e extrato na Fase 5 */}
      <div className="rounded-2xl border border-border/80 bg-surface p-6 shadow-xs">
        <p className="text-sm text-muted-foreground">
          {myFamilyData?.family?.name
            ? `Unidade familiar ativa: ${myFamilyData.family.name}`
            : "Orçamento e acompanhamento colaborativo de gastos da casa."}
        </p>
      </div>
    </div>
  );
}
