import { useState } from "react";
import { useNavigate } from "react-router";
import { Settings, UserPlus } from "lucide-react";
import {
  Badge,
  Button,
  ErrorState,
  FamilySkeleton,
  Skeleton,
} from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { MonthPicker } from "@/components/modules/month-picker";
import { currentMonth } from "@/lib/date";
import {
  useFamilyConsolidation,
  useFamilyMode,
  useFamilyPortfolioSummary,
  useMyFamily,
} from "@/state";
import {
  FamilyCreateModal,
  FamilySettingsDialog,
  FamilySettlementDialog,
  FamilyShareAssetsDialog,
} from "../components";
import { FamilyConsolidationDashboard } from "../components/family-consolidation-dashboard";
import {
  FamilyEmptySetupView,
  FamilyModeInactiveView,
} from "../components/family-onboarding-empty-view";

/**
 * Hub de Gestão e Orçamento Familiar (/familia).
 * Exibe a consolidação de gastos da casa, equilíbrio entre participantes,
 * fatias de consumo por categoria, extrato filtrável e liquidação via Pix.
 */
export function FamilyPage() {
  const navigate = useNavigate();
  const { data: myFamilyData, isLoading: isFamilyLoading } = useMyFamily();
  const {
    isFamilyModeEnabled,
    toggleFamilyMode,
    isLoading: isModeLoading,
    isPending: isTogglingMode,
  } = useFamilyMode();

  const [month, setMonth] = useState<string>(() => currentMonth());
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isShareAssetsOpen, setIsShareAssetsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>("general");

  const hasFamily = Boolean(myFamilyData?.family);

  const {
    data: consolidation,
    isLoading: isConsolidationLoading,
    error: consolidationError,
    refetch,
  } = useFamilyConsolidation(month, { enabled: hasFamily });

  const { data: portfolioSummary } = useFamilyPortfolioSummary(
    myFamilyData?.family?.id,
    { enabled: hasFamily },
  );

  if (isFamilyLoading || isModeLoading) {
    return (
      <div aria-busy="true" data-testid="family-page-skeleton">
        <FamilySkeleton />
      </div>
    );
  }

  if (!isFamilyModeEnabled) {
    return (
      <FamilyModeInactiveView
        isTogglingMode={isTogglingMode}
        onActivateMode={() => void toggleFamilyMode(true)}
        onGoHome={() => navigate("/")}
      />
    );
  }

  if (!myFamilyData?.family) {
    return (
      <>
        <FamilyEmptySetupView onOpenCreate={() => setIsCreateModalOpen(true)} />
        <FamilyCreateModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
        />
      </>
    );
  }

  const isOwner = myFamilyData.currentMember?.role === "owner";
  const activeMembersCount = myFamilyData.members?.length ?? 1;
  const isFamilyFull = activeMembersCount >= 6;

  return (
    <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
      <PageHeader
        title="Modo Família"
        description="Acompanhamento colaborativo, fatias de consumo e equilíbrio de contas da casa."
        badge={
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="default" size="sm">
              {myFamilyData.family.name}
            </Badge>
            <Badge variant="muted" size="sm">
              {activeMembersCount} de 6 membros
            </Badge>
          </div>
        }
        actions={
          <>
            {isOwner && !isFamilyFull && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                sensoryIntent="selection"
                className="gap-1.5 max-sm:min-h-11"
                onClick={() => {
                  setSettingsTab("members");
                  setIsSettingsOpen(true);
                }}
                aria-label="Convidar novo membro da família"
              >
                <UserPlus className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Convidar</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent="selection"
              className="gap-1.5 max-sm:min-h-11"
              onClick={() => {
                setSettingsTab("general");
                setIsSettingsOpen(true);
              }}
              aria-label="Abrir configurações da família"
              title="Abrir configurações da família"
            >
              <Settings className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Ajustes</span>
            </Button>
          </>
        }
      />

      <MonthPicker
        value={month}
        onValueChange={setMonth}
        aria-label="Selecionar mês da consolidação familiar"
      />

      {consolidationError ? (
        <ErrorState
          message="Não foi possível carregar a consolidação familiar deste mês."
          onRetry={() => void refetch()}
        />
      ) : isConsolidationLoading ? (
        <div className="space-y-6" aria-busy="true">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-52 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : consolidation ? (
        <>
          <FamilyConsolidationDashboard
            consolidation={consolidation}
            portfolioSummary={portfolioSummary}
            currentUserId={myFamilyData.currentMember?.user_id}
            onOpenSettlement={() => setIsSettlementOpen(true)}
            onOpenManageAssets={() => setIsShareAssetsOpen(true)}
          />

          {consolidation.family.split_rule !== "combined" && (
            <FamilySettlementDialog
              open={isSettlementOpen}
              onOpenChange={setIsSettlementOpen}
              consolidation={consolidation}
              currentUserId={myFamilyData.currentMember?.user_id}
            />
          )}

          <FamilyShareAssetsDialog
            open={isShareAssetsOpen}
            onOpenChange={setIsShareAssetsOpen}
          />

          <FamilySettingsDialog
            open={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
            initialTab={settingsTab}
          />
        </>
      ) : null}
    </div>
  );
}
