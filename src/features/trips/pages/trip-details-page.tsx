/**
 * Página de Detalhes da Viagem (/viagens/:id).
 * Visão do organizador e membros autenticados no Áxis Finance.
 */

import { useState } from "react";
import { useParams, Link } from "react-router";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Share2,
  Receipt,
  Plus,
  Trash2,
  Pencil,
  Check,
  DollarSign,
  ShieldCheck,
  Scale,
  FileText,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  Tabs,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import {
  useTripDetails,
  useRemoveTripMemberMutation,
} from "@/state/queries/use-trips";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getPublicAppUrl } from "@/services/app-url";
import { useNavigate } from "react-router";
import { useTripMode } from "@/state";
import { useAuth } from "@/hooks/use-auth";
import { resolveActiveTripMember } from "@/domain/trips";
import {
  AddTripMemberDialog,
  AddTripExpenseDialog,
  EditTripExpenseDialog,
  TripSettlementDialog,
  TripMemberStatementDialog,
  RebalanceTripSplitsDialog,
  TripExpenseDeleteDialog,
  TripPersonalContextCard,
} from "../components";
import type { TripMember, TripExpense } from "@/types/trips";

export function TripDetailsPage() {
  const navigate = useNavigate();
  const { id: tripId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isTripModeEnabled, toggleTripMode, isPending: isTogglingTripMode } = useTripMode();
  const { data, isLoading } = useTripDetails(tripId);

  const [activeTab, setActiveTab] = useState<string>("expenses");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isRebalanceOpen, setIsRebalanceOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<TripExpense | null>(null);
  const [selectedMemberForStatement, setSelectedMemberForStatement] = useState<TripMember | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [filterMyExpenses, setFilterMyExpenses] = useState(false);

  const removeMemberMutation = useRemoveTripMemberMutation(tripId ?? "");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isTripModeEnabled) {
    return (
      <div className="space-y-6" data-testid="trip-mode-inactive">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <Receipt className="size-5 text-muted-foreground" aria-hidden="true" />
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
            icon={<Receipt className="size-10 text-muted-foreground" aria-hidden="true" />}
            title="Modo Viagem desativado"
            description="Ative o Modo Viagem para acessar os detalhes, balanços e acertos desta viagem. Seus dados continuam salvos com segurança."
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
                  onClick={() => navigate("/viagens")}
                  className="rounded-xl cursor-pointer"
                >
                  Voltar para Viagens
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-4 pt-16">
        <EmptyState
          icon={<Receipt className="size-8" />}
          title="Viagem não encontrada"
          description="A viagem pode ter sido excluída ou você não possui permissão para acessá-la."
        />
        <Link to="/viagens">
          <Button variant="outline" className="w-full">
            Voltar para Viagens
          </Button>
        </Link>
      </div>
    );
  }

  const { trip, members, expenses, settlements, balances, suggestedSettlements, totalExpensesCents } = data;

  const myMember = resolveActiveTripMember(members, user?.id, trip.host_user_id);
  const isHost = Boolean(user && trip.host_user_id === user.id) || Boolean(myMember?.is_host);
  const myBalance = myMember ? (balances.find((b) => b.memberId === myMember.id) ?? null) : null;
  const displayedExpenses = filterMyExpenses && myMember
    ? expenses.filter((e) => e.paid_by_member_id === myMember.id)
    : expenses;

  const handleCopyPublicLink = () => {
    const url = getPublicAppUrl(`viagem/${trip.public_token}`);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    triggerSensory("success");
    pushToast({
      title: "Link de compartilhamento copiado",
      description: "Envie este link no grupo para que os amigos lancem despesas sem precisar de login.",
    });
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const tabItems = [
    {
      value: "expenses",
      label: `Despesas (${expenses.length})`,
      content: (
        <div className="space-y-2.5 mt-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              {filterMyExpenses ? "Meus Gastos na Viagem" : "Gastos do Grupo"}
            </span>
            <div className="flex items-center gap-2">
              {isHost && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsRebalanceOpen(true)}
                  className="h-8 text-xs gap-1.5"
                  title="Rateia todas as despesas da viagem igualmente entre todos os membros"
                >
                  <Scale className="size-3" aria-hidden="true" />
                  Equilibrar Tudo
                </Button>
              )}
              <Button
                size="sm"
                variant="default"
                onClick={() => setIsAddExpenseOpen(true)}
                className="h-8 text-xs gap-1"
              >
                <Plus className="size-3" aria-hidden="true" />
                Nova Despesa
              </Button>
            </div>
          </div>

          {displayedExpenses.length === 0 ? (
            <Card className="p-8 border-border/80 bg-surface text-center">
              <EmptyState
                icon={<Receipt className="size-8" />}
                title={filterMyExpenses ? "Nenhum gasto seu encontrado" : "Nenhuma despesa lançada"}
                description={
                  filterMyExpenses
                    ? "Você ainda não possui despesas registradas como pagador nesta viagem."
                    : "Adicione o primeiro gasto da viagem para dividir com os amigos ou compartilhe o link público."
                }
                action={
                  filterMyExpenses ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFilterMyExpenses(false)}
                      className="gap-1.5 mt-2"
                    >
                      Ver Todos os Gastos
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setIsAddExpenseOpen(true)}
                      className="gap-1.5 mt-2"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      Adicionar Despesa
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            displayedExpenses.map((expense) => {
              const payer = members.find((m) => m.id === expense.paid_by_member_id);
              const eligibleMembers = members.filter(
                (m) => !m.joined_date || !expense.expense_date || expense.expense_date >= m.joined_date
              );
              const isCustom = expense.split_type === "custom";
              const participantCount = isCustom
                ? (expense.splits?.length ?? 0)
                : (eligibleMembers.length > 0 ? eligibleMembers.length : members.length);
              const isPartial = isCustom || participantCount < members.length;

              return (
                <Card
                  key={expense.id}
                  className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {expense.description}
                      </span>
                      <Badge size="xs" variant="muted">
                        {expense.category_name}
                      </Badge>
                      {isPartial ? (
                        <Badge size="xs" variant="warning">
                          {participantCount} de {members.length} amigos
                        </Badge>
                      ) : (
                        <Badge size="xs" variant="muted">
                          Todos ({members.length})
                        </Badge>
                      )}
                      {expense.linked_personal_expense_id && (
                        <Badge size="xs" variant="positive">
                          Vinculada ao Cartão
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Pago por <span className="font-medium text-foreground">{payer?.name ?? "Membro"}</span> em {expense.expense_date}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className="text-xs font-bold tabular-nums text-foreground">
                      {formatCentsAsBRL(expense.amount_cents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingExpense(expense)}
                      className="text-muted-foreground hover:text-foreground p-1 transition-colors cursor-pointer"
                      title="Editar despesa"
                      aria-label="Editar despesa"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingExpense(expense)}
                      className="text-muted-foreground hover:text-critical p-1 transition-colors cursor-pointer"
                      title="Excluir despesa"
                      aria-label="Excluir despesa"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ),
    },
    {
      value: "members",
      label: `Participantes (${members.length})`,
      content: (
        <div className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Membros do Grupo
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddMemberOpen(true)}
              className="h-8 text-xs gap-1"
            >
              <Plus className="size-3" aria-hidden="true" />
              Adicionar Membro
            </Button>
          </div>

          <div className="space-y-2">
            {members.map((member) => {
              const memBalance = balances.find((b) => b.memberId === member.id);
              const paid = memBalance?.totalPaidCents ?? 0;
              const net = memBalance?.netBalanceCents ?? 0;

              return (
                <Card
                  key={member.id}
                  className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground truncate">{member.name}</span>
                      {member.is_host && (
                        <Badge size="xs" variant="default">
                          Organizador
                        </Badge>
                      )}
                      {member.user_id && (
                        <Badge size="xs" variant="positive">
                          Conta Áxis
                        </Badge>
                      )}
                      {myMember && member.id === myMember.id && (
                        <Badge size="xs" variant="warning">
                          Você
                        </Badge>
                      )}
                      {member.joined_date && (
                        <Badge size="xs" variant="muted">
                          Entrou em {member.joined_date}
                        </Badge>
                      )}
                      {net > 0 && (
                        <Badge size="xs" variant="positive">
                          A receber: +{formatCentsAsBRL(net)}
                        </Badge>
                      )}
                      {net < 0 && (
                        <Badge size="xs" variant="warning">
                          A pagar: {formatCentsAsBRL(Math.abs(net))}
                        </Badge>
                      )}
                      {net === 0 && (
                        <Badge size="xs" variant="muted">
                          Equilibrado
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      <span>
                        Total pago: <strong className="text-foreground">{formatCentsAsBRL(paid)}</strong>
                      </span>
                      {member.pix_key && (
                        <span className="font-mono">Pix: {member.pix_key}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedMemberForStatement(member)}
                      className="h-7 text-[11px] px-2.5 gap-1 cursor-pointer"
                    >
                      <FileText className="size-3" aria-hidden="true" />
                      Extrato
                    </Button>

                    {isHost && !member.is_host && (
                      <button
                        type="button"
                        onClick={() => removeMemberMutation.mutate(member.id)}
                        className="text-muted-foreground hover:text-critical p-1 transition-colors"
                        title="Remover membro"
                        aria-label={`Remover ${member.name}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      value: "settlements",
      label: `Acerto (${suggestedSettlements.length})`,
      content: (
        <div className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Compensação Líquida Calculada
            </span>
            <Button
              size="sm"
              onClick={() => setIsSettlementOpen(true)}
              className="h-8 text-xs gap-1"
            >
              <ShieldCheck className="size-3" aria-hidden="true" />
              Ver Detalhes do Acerto
            </Button>
          </div>

          {suggestedSettlements.length === 0 ? (
            <Card className="p-8 border-border/80 bg-surface text-center">
              <EmptyState
                icon={<ShieldCheck className="size-8" />}
                title="Contas zeradas"
                description="Todos os valores estão equilibrados."
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {suggestedSettlements.map((s, idx) => (
                <Card
                  key={`${s.fromMemberId}-${s.toMemberId}-${idx}`}
                  className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-foreground">{s.fromMemberName}</span>
                    <span className="text-muted-foreground mx-1.5">transfere para</span>
                    <span className="font-semibold text-primary">{s.toMemberName}</span>
                  </div>
                  <span className="font-bold tabular-nums text-foreground">
                    {formatCentsAsBRL(s.amountCents)}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Botão de Retorno */}
      <Link
        to="/viagens"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Voltar para todas as viagens
      </Link>

      {/* Cockpit Contextual Pessoal */}
      <TripPersonalContextCard
        trip={trip}
        myMember={myMember}
        myBalance={myBalance}
        isHost={isHost}
        onOpenSettlement={() => setIsSettlementOpen(true)}
        onOpenStatement={myMember ? () => setSelectedMemberForStatement(myMember) : undefined}
        isFilterActive={filterMyExpenses}
        onToggleFilterMyExpenses={() => setFilterMyExpenses((prev) => !prev)}
      />

      {/* Cabeçalho da Viagem */}
      <Card className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {trip.title}
              </h1>
              <Badge
                size="sm"
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

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => setIsAddExpenseOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Adicionar Despesa
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyPublicLink}
              className="h-8 text-xs gap-1.5"
            >
              {copiedLink ? (
                <>
                  <Check className="size-3.5 text-positive" aria-hidden="true" />
                  Link Copiado!
                </>
              ) : (
                <>
                  <Share2 className="size-3.5" aria-hidden="true" />
                  Link Público
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-tour="trip-settlement-card"
              onClick={() => setIsSettlementOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <DollarSign className="size-3.5" aria-hidden="true" />
              Fechar Contas
            </Button>
          </div>
        </div>

        {/* Trinca de Métricas */}
        <div data-tour="trip-balances" className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/80">
          <div className="p-3 rounded-xl bg-surface-raised border border-border/60">
            <p className="text-[11px] text-muted-foreground font-medium">Total do Grupo</p>
            <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">
              {formatCentsAsBRL(totalExpensesCents)}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-surface-raised border border-border/60">
            <p className="text-[11px] text-muted-foreground font-medium">Seu Balanço Líquido</p>
            <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">
              {myBalance
                ? myBalance.netBalanceCents > 0
                  ? `+ ${formatCentsAsBRL(myBalance.netBalanceCents)}`
                  : formatCentsAsBRL(myBalance.netBalanceCents)
                : "R$ 0,00"}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-surface-raised border border-border/60">
            <p className="text-[11px] text-muted-foreground font-medium">Participantes</p>
            <p className="text-base sm:text-lg font-bold text-foreground">
              {members.length} amigos
            </p>
          </div>
        </div>
      </Card>

      {/* Abas */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        items={tabItems}
        variant="pills"
        fullWidth
      />

      {/* Diálogos */}
      <AddTripExpenseDialog
        open={isAddExpenseOpen}
        onOpenChange={setIsAddExpenseOpen}
        tripId={trip.id}
        members={members}
      />

      <EditTripExpenseDialog
        open={Boolean(editingExpense)}
        onOpenChange={(open) => !open && setEditingExpense(null)}
        tripId={trip.id}
        expense={editingExpense}
        members={members}
      />

      <AddTripMemberDialog
        open={isAddMemberOpen}
        onOpenChange={setIsAddMemberOpen}
        tripId={trip.id}
      />

      <TripSettlementDialog
        open={isSettlementOpen}
        onOpenChange={setIsSettlementOpen}
        tripId={trip.id}
        tripTitle={trip.title}
        publicToken={trip.public_token}
        suggestedSettlements={suggestedSettlements}
        existingSettlements={settlements}
        members={members}
        expenses={expenses}
      />

      <TripMemberStatementDialog
        open={Boolean(selectedMemberForStatement)}
        onOpenChange={(open) => !open && setSelectedMemberForStatement(null)}
        member={selectedMemberForStatement}
        members={members}
        expenses={expenses}
      />

      <RebalanceTripSplitsDialog
        open={isRebalanceOpen}
        onOpenChange={setIsRebalanceOpen}
        tripId={trip.id}
        membersCount={members.length}
      />

      <TripExpenseDeleteDialog
        open={Boolean(deletingExpense)}
        onOpenChange={(open) => !open && setDeletingExpense(null)}
        tripId={trip.id}
        expense={deletingExpense}
      />
    </div>
  );
}
