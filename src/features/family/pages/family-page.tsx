import { useState } from "react";
import { useNavigate } from "react-router";
import { AlertCircle, Plus, RotateCcw, Settings, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout";
import { MonthPicker } from "@/components/modules/month-picker";
import { currentMonth } from "@/lib/date";
import {
  useFamilyMode,
  useMyFamily,
  useFamilyConsolidation,
  useFamilyPortfolioSummary,
} from "@/state";
import {
  HouseholdCeilingCard,
  HouseholdBalanceCard,
  HouseholdComparisonCard,
  HouseholdClusteringRanking,
  HouseholdExpenseFeed,
  FamilySettlementDialog,
  FamilyCreateModal,
  HouseholdCombinedFlowCard,
  HouseholdWealthCard,
  FamilyShareAssetsDialog,
  FamilySettingsDialog,
} from "../components";

/**
 * Hub de Gestão e Orçamento Familiar (/familia).
 * Exibe a consolidação de gastos da casa, equilíbrio entre participantes,
 * fatias de consumo por categoria, extrato filtrável e liquidação via Pix.
 * Acesso condicional restrito a participantes com Modo Familiar ativo.
 * Suporta até 6 participantes por família com Zero Data Bleed.
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

  const { data: portfolioSummary } = useFamilyPortfolioSummary(myFamilyData?.family?.id, {
    enabled: hasFamily,
  });

  const isLoading = isFamilyLoading || isModeLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" data-testid="family-page-skeleton">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-56 rounded-xl" />
          <Skeleton className="h-9 w-48 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  // Se o Modo Familiar estiver desativado nas preferências, exibe o card explicativo de ativação
  if (!isFamilyModeEnabled) {
    return (
      <div className="space-y-6" data-testid="family-mode-inactive">
        <PageHeader
          title={
            <div className="flex items-center gap-2.5">
              <Users className="size-5 text-muted-foreground" aria-hidden="true" />
              <span>Orçamento Familiar</span>
            </div>
          }
          description="Acompanhamento colaborativo, fatias de consumo e equilíbrio de contas da casa."
        />

        <Card className="border-border/80 bg-surface shadow-xs p-6 sm:p-10 rounded-2xl text-center">
          <EmptyState
            icon={<Users className="size-10 text-muted-foreground" aria-hidden="true" />}
            title="Modo Familiar desativado"
            description="O Modo Familiar consolida os gastos da residência, calcula o teto de gastos da casa e realiza acertos justos de contas via Pix, mantendo suas contas e compras pessoais sob total privacidade."
            action={
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isTogglingMode}
                  onClick={() => toggleFamilyMode(true)}
                  className="gap-2 rounded-xl cursor-pointer"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  <span>{isTogglingMode ? "Ativando..." : "Ativar Modo Familiar"}</span>
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

  // Se não houver família criada ainda, exibe o EmptyState explicativo com criação direta
  if (!myFamilyData?.family) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={
            <div className="flex items-center gap-2.5">
              <Users className="size-5 text-muted-foreground" aria-hidden="true" />
              <span>Orçamento Familiar</span>
            </div>
          }
          description="Acompanhamento colaborativo, fatias de consumo e equilíbrio de contas da casa."
        />

        <Card className="border-border/80 bg-surface shadow-xs p-6 sm:p-10 rounded-2xl text-center">
          <EmptyState
            icon={<Users className="size-10 text-muted-foreground" aria-hidden="true" />}
            title="Nenhuma família criada ainda"
            description="Crie o seu grupo familiar para acompanhar despesas compartilhadas, definir o teto mensal da casa e fazer acertos justos de contas. Suas contas e despesas pessoais permanecem estritamente privadas."
            action={
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="gap-2 rounded-xl cursor-pointer"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span>Criar Família</span>
              </Button>
            }
          />
        </Card>

        <FamilyCreateModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
        />
      </div>
    );
  }

  const isOwner = myFamilyData.currentMember?.role === "owner";
  const activeMembersCount = myFamilyData.members?.length ?? 1;
  const isFamilyFull = activeMembersCount >= 6;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <Users className="size-5 text-muted-foreground" aria-hidden="true" />
            <span>Orçamento Familiar</span>
          </div>
        }
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
          <div className="flex items-center gap-2">
            {isOwner && !isFamilyFull && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setSettingsTab("members");
                  setIsSettingsOpen(true);
                }}
                aria-label="Convidar novo membro da família"
              >
                <UserPlus className="size-3.5" aria-hidden="true" />
                <span>Convidar</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => {
                setSettingsTab("general");
                setIsSettingsOpen(true);
              }}
              aria-label="Abrir configurações da família"
            >
              <Settings className="size-4" aria-hidden="true" />
            </Button>
          </div>
        }
      />

      {/* Linha do Seletor de Mês — full-width, padrão idêntico a Visão Geral e Transações */}
      <MonthPicker
        value={month}
        onValueChange={setMonth}
        aria-label="Selecionar mês da consolidação familiar"
      />

      {/* Tratamento de Erro de Consolidação */}
      {consolidationError ? (
        <div
          role="alert"
          className="p-6 rounded-2xl border border-critical/30 bg-critical/10 space-y-3 text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-critical shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-critical-strong">
                Não foi possível carregar a consolidação familiar deste mês.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verifique sua conexão e tente novamente.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 self-center sm:self-auto rounded-xl cursor-pointer"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Tentar novamente</span>
          </Button>
        </div>
      ) : isConsolidationLoading ? (
        <div className="space-y-6 animate-pulse" aria-busy="true">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-52 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : consolidation ? (
        <>
          {consolidation.family.split_rule === "combined" ? (
            /* ===== MODO FINANÇAS CONJUNTAS (CAIXA ÚNICO) ===== */
            <div className="space-y-6">
              {/* 1. Cockpit Operacional do Mês (2 Colunas): Fluxo do Lar + Teto Orçamentário */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <HouseholdCombinedFlowCard
                  totalIncomeCents={consolidation.total_income_cents}
                  totalSpentCents={consolidation.total_spent_cents}
                />

                <HouseholdCeilingCard
                  monthlyCeilingCents={consolidation.monthly_ceiling_cents}
                  totalSpentCents={consolidation.total_spent_cents}
                  remainingCents={consolidation.remaining_cents}
                  spentPercentage={consolidation.spent_percentage}
                  totalIncomeCents={consolidation.total_income_cents}
                />
              </section>

              {/* 2. Segurança Patrimonial & Reserva Familiar (Linha Única / Full-Width) */}
              <section>
                <HouseholdWealthCard
                  portfolioSummary={portfolioSummary}
                  monthlyCeilingCents={consolidation.monthly_ceiling_cents}
                  monthlyExpensesCents={consolidation.total_spent_cents}
                  onOpenManageAssets={() => setIsShareAssetsOpen(true)}
                />
              </section>

              {/* 3. Raio-X de Consumo por Categoria (Linha Única / Full-Width) */}
              <section>
                <HouseholdClusteringRanking expenses={consolidation.expenses} />
              </section>

              {/* 4. Extrato Consolidado da Casa (Linha Única / Full-Width) */}
              <section>
                <HouseholdExpenseFeed
                  expenses={consolidation.expenses}
                  currentUserId={myFamilyData.currentMember?.user_id}
                />
              </section>
            </div>
          ) : (
            /* ===== MODO DIVISÃO DE DESPESAS (RATEIO 50/50 OU PROPORCIONAL) ===== */
            <div className="space-y-6">
              {/* 1. Painel Operacional do Mês (2 Colunas): Teto da Casa + Equilíbrio do Mês */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <HouseholdCeilingCard
                  monthlyCeilingCents={consolidation.monthly_ceiling_cents}
                  totalSpentCents={consolidation.total_spent_cents}
                  remainingCents={consolidation.remaining_cents}
                  spentPercentage={consolidation.spent_percentage}
                  totalIncomeCents={consolidation.total_income_cents}
                />

                <HouseholdBalanceCard
                  members={consolidation.members}
                  splitRule={consolidation.family.split_rule}
                  isSettled={consolidation.is_settled}
                  settlement={consolidation.settlement}
                  hasPostSettlementExpenses={consolidation.has_post_settlement_expenses}
                  onOpenSettlement={() => setIsSettlementOpen(true)}
                />
              </section>

              {/* 2. Auditoria & Divisão Justa entre Participantes (Linha Única / Full-Width) */}
              <section>
                <HouseholdComparisonCard
                  members={consolidation.members}
                  expenses={consolidation.expenses}
                  monthlyCeilingCents={consolidation.monthly_ceiling_cents}
                  splitRule={consolidation.family.split_rule}
                  month={consolidation.month}
                />
              </section>

              {/* 3. Segurança Patrimonial & Reserva Familiar (Linha Única / Full-Width) */}
              <section>
                <HouseholdWealthCard
                  portfolioSummary={portfolioSummary}
                  monthlyCeilingCents={consolidation.monthly_ceiling_cents}
                  monthlyExpensesCents={consolidation.total_spent_cents}
                  onOpenManageAssets={() => setIsShareAssetsOpen(true)}
                />
              </section>

              {/* 4. Consumo por Categorias da Casa (Linha Única / Full-Width) */}
              <section>
                <HouseholdClusteringRanking expenses={consolidation.expenses} />
              </section>

              {/* 5. Extrato Consolidado da Casa (Linha Única / Full-Width) */}
              <section>
                <HouseholdExpenseFeed
                  expenses={consolidation.expenses}
                  currentUserId={myFamilyData.currentMember?.user_id}
                />
              </section>
            </div>
          )}

          {/* Diálogo de Acerto de Contas & Chave Pix (apenas em modo de rateio) */}
          {consolidation.family.split_rule !== "combined" && (
            <FamilySettlementDialog
              open={isSettlementOpen}
              onOpenChange={setIsSettlementOpen}
              consolidation={consolidation}
              currentUserId={myFamilyData.currentMember?.user_id}
            />
          )}

          {/* Diálogo de Compartilhamento de Ativos & Classes com a Família */}
          <FamilyShareAssetsDialog
            open={isShareAssetsOpen}
            onOpenChange={setIsShareAssetsOpen}
          />

          {/* Diálogo Completo de Configurações da Família (Regras, Dados Pix, Membros & Convites) */}
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
