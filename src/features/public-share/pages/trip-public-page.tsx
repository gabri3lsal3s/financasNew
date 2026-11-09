/**
 * Página pública de visualização e colaboração do Modo Viagem (/viagem/:token).
 * Permite que participantes sem conta visualizem despesas, saldos, auditem extratos e adicionem gastos.
 * Cumpre regras DRY, acessibilidade e design system (zero controles nativos, zero emojis).
 */

import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  Plus,
  Receipt,
  Copy,
  Check,
  Calendar,
  MapPin,
  Share2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  Tabs,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { usePublicTrip, useUserTrips } from "@/state/queries/use-trips";
import { useAuth } from "@/hooks/use-auth";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getPublicAppUrl } from "@/services/app-url";
import {
  SharedLinkHeaderNav,
  AddPublicTripExpenseDialog,
  PublicTripMemberStatementDialog,
  PublicTripIdentityBanner,
  ClaimTripMemberDialog,
} from "../components";
import { usePublicTripGuestIdentity } from "../hooks";
import type { PublicTripMember } from "@/types/trips";

export function TripPublicPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const currentUser = session?.user;
  const { data: userTrips } = useUserTrips();

  const { data, isLoading, error } = usePublicTrip(token);
  const { activeMemberId, setActiveMemberId } = usePublicTripGuestIdentity(token);

  const [activeTab, setActiveTab] = useState<string>("expenses");
  const [selectedMemberForStatement, setSelectedMemberForStatement] = useState<PublicTripMember | null>(null);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [copiedPixKey, setCopiedPixKey] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center p-4">
        <div className="w-full max-w-2xl space-y-4 pt-12">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center space-y-4 border-border/80 bg-surface shadow-xs rounded-2xl">
          <EmptyState
            icon={<Receipt className="size-8 text-muted-foreground" aria-hidden="true" />}
            title="Viagem não encontrada"
            description="O link informado pode ter expirado, sido removido ou o código de acesso está incorreto."
          />
          <Link to="/">
            <Button variant="outline" className="w-full">
              Ir para a página inicial
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { trip, members, expenses, balances, suggestedSettlements, totalExpensesCents } = data;

  const isAlreadyLinked = Boolean(
    currentUser &&
    userTrips?.some((t) => t.id === trip.id || t.public_token === token)
  );
  const claimableMembers = members.filter((m) => !m.has_axis_account);
  const canClaimAccount = Boolean(
    currentUser &&
    !isAlreadyLinked &&
    claimableMembers.length > 0
  );

  const currentBalance = activeMemberId
    ? balances.find((b) => b.memberId === activeMemberId) ?? null
    : null;

  const handleCopyPix = (pixKey: string) => {
    navigator.clipboard.writeText(pixKey);
    setCopiedPixKey(pixKey);
    triggerSensory("success");
    pushToast({
      title: "Chave Pix copiada",
      description: "Cole no seu aplicativo bancário para realizar a transferência.",
    });
    setTimeout(() => setCopiedPixKey(null), 3000);
  };

  const handleShareWhatsApp = () => {
    let message = `*Resumo da Viagem: ${trip.title}*\n`;
    if (trip.destination) message += `Destino: ${trip.destination}\n`;
    message += `Total gasto pelo grupo: ${formatCentsAsBRL(totalExpensesCents)}\n\n`;

    if (suggestedSettlements.length > 0) {
      message += `*Acerto de Contas (Quem paga para quem):*\n`;
      suggestedSettlements.forEach((s) => {
        message += `• ${s.fromMemberName} transfere ${formatCentsAsBRL(s.amountCents)} para ${s.toMemberName}`;
        if (s.toPixKey) message += ` (Pix: ${s.toPixKey})`;
        message += `\n`;
      });
    } else {
      message += `Todas as despesas estão balanceadas!\n`;
    }

    message += `\nVer extrato completo: ${getPublicAppUrl(`viagem/${trip.public_token}`)}`;

    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  const tabItems = [
    {
      value: "expenses",
      label: `Despesas (${expenses.length})`,
      content: (
        <div className="space-y-2.5 mt-3">
          {expenses.length === 0 ? (
            <Card className="border-border/80 bg-surface shadow-xs rounded-2xl p-6 text-center">
              <EmptyState
                icon={<Receipt className="size-8 text-muted-foreground" aria-hidden="true" />}
                title="Nenhum gasto registrado"
                description="Clique em 'Adicionar Despesa' para lançar o primeiro gasto do grupo."
              />
            </Card>
          ) : (
            expenses.map((expense) => {
              const payer = members.find((m) => m.id === expense.paid_by_member_id);
              const isCustom = expense.split_type === "custom";
              const isPartial = isCustom || (expense.splits && expense.splits.length < members.length);
              const participantCount = expense.splits?.length ?? members.length;

              return (
                <Card
                  key={expense.id}
                  className="border-border/80 bg-surface shadow-xs rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3"
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
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Pago por <span className="font-medium text-foreground">{payer?.name ?? "Membro"}</span> em {expense.expense_date}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold tabular-nums text-foreground whitespace-nowrap">
                      {formatCentsAsBRL(expense.amount_cents)}
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ),
    },
    {
      value: "settlements",
      label: `Acerto de Contas (${suggestedSettlements.length})`,
      content: (
        <div className="space-y-2.5 mt-3">
          {suggestedSettlements.length === 0 ? (
            <Card className="border-border/80 bg-surface shadow-xs rounded-2xl p-6 text-center">
              <EmptyState
                icon={<ShieldCheck className="size-8 text-muted-foreground" aria-hidden="true" />}
                title="Tudo equilibrado"
                description="Não há transferências pendentes para liquidar esta viagem."
              />
            </Card>
          ) : (
            suggestedSettlements.map((settlement, idx) => (
              <Card
                key={`${settlement.fromMemberId}-${settlement.toMemberId}-${idx}`}
                className="border-border/80 bg-surface shadow-xs rounded-xl p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">
                    <span>{settlement.fromMemberName}</span>
                    <span className="text-muted-foreground font-normal mx-1.5">paga para</span>
                    <span className="text-primary-strong">{settlement.toMemberName}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    {formatCentsAsBRL(settlement.amountCents)}
                  </span>
                </div>

                {settlement.toPixKey && (
                  <div className="flex items-center justify-between bg-surface-raised border border-border/80 p-2.5 rounded-xl text-xs gap-2">
                    <div className="min-w-0 truncate">
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Chave Pix ({settlement.toPixKeyType ?? "Pix"}):
                      </span>
                      <span className="font-mono text-xs text-foreground truncate block font-medium">
                        {settlement.toPixKey}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyPix(settlement.toPixKey!)}
                      className="h-8 px-2.5 text-xs gap-1.5 shrink-0 cursor-pointer"
                    >
                      {copiedPixKey === settlement.toPixKey ? (
                        <>
                          <Check className="size-3.5 text-positive" aria-hidden="true" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" aria-hidden="true" />
                          <span>Copiar Pix</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-16">
      <SharedLinkHeaderNav
        badgeLabel="Modo Viagem"
        targetPath={`viagem/${token ?? ""}`}
        maxWidth="2xl"
      />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-4 space-y-4">
        {/* Card Hero da Viagem */}
        <Card className="border-border/80 bg-surface shadow-xs rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  {trip.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                  {trip.destination && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>{trip.destination}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>{trip.start_date} até {trip.end_date}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <Badge size="sm" variant={trip.status === "completed" ? "positive" : "muted"}>
                  {trip.status === "completed" ? "Finalizada" : "Em andamento"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShareWhatsApp}
                  className="h-8 gap-1.5 text-xs cursor-pointer"
                >
                  <Share2 className="size-3.5" aria-hidden="true" />
                  <span>Compartilhar</span>
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Total Gasto na Viagem</p>
                <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">
                  {formatCentsAsBRL(totalExpensesCents)}
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddExpenseOpen(true)}
                className="h-9 gap-1.5 text-xs font-semibold self-stretch sm:self-auto cursor-pointer"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Adicionar Despesa</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* Banner de Destaque: Vincular Viagem à Conta Áxis */}
        {currentUser && !isAlreadyLinked && (
          <Card className="border-primary/30 bg-primary/5 shadow-xs rounded-2xl p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary-strong">
                <Sparkles className="size-4.5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  Você está conectado ao Áxis
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Vincule sua participação para sincronizar rateios e despesas diretamente no seu extrato pessoal.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={() => setIsClaimDialogOpen(true)}
              className="h-8.5 px-3.5 text-xs font-semibold self-stretch sm:self-auto shrink-0 gap-1.5 cursor-pointer"
            >
              <UserCheck className="size-3.5" aria-hidden="true" />
              <span>Vincular esta viagem ao meu aplicativo Áxis</span>
            </Button>
          </Card>
        )}

        {/* Banner Sóbrio: Viagem já Vinculada */}
        {currentUser && isAlreadyLinked && (
          <Card className="border-border/80 bg-surface shadow-xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  Esta viagem está sincronizada com a sua conta Áxis
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Acesse para gerenciar gastos, categorias e conferir o rateio no painel principal.
                </p>
              </div>
            </div>
            <Link to={`/viagens/${trip.id}`} className="shrink-0 self-stretch sm:self-auto">
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto h-8 gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <span>Abrir no Aplicativo</span>
                <ArrowRight className="size-3" aria-hidden="true" />
              </Button>
            </Link>
          </Card>
        )}

        {/* Banner de Identificação no Topo da Viagem */}
        <PublicTripIdentityBanner
          token={token!}
          members={members}
          activeMemberId={activeMemberId}
          onSelectMember={setActiveMemberId}
          balance={currentBalance}
          onOpenStatement={setSelectedMemberForStatement}
          onClaimAccount={canClaimAccount ? () => setIsClaimDialogOpen(true) : undefined}
        />

        {/* Abas com Tabs nativo do app */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={tabItems}
          variant="pills"
          fullWidth
        />

        {/* Rodapé Institucional de Conversão */}
        <Card className="border-border/80 bg-surface shadow-xs rounded-2xl p-4 sm:p-5 text-center space-y-2.5 mt-6">
          <p className="text-xs font-semibold text-foreground">
            Gostou da organização desta viagem?
          </p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            O Áxis Finance é um aplicativo completo de finanças pessoais, cartões, despesas compartilhadas e projeção.
          </p>
          <Link to="/cadastro" className="inline-block pt-1">
            <Button size="sm" variant="default" className="gap-1.5 text-xs cursor-pointer font-medium">
              <span>Criar minha conta gratuita</span>
              <ArrowRight className="size-3" aria-hidden="true" />
            </Button>
          </Link>
        </Card>
      </main>

      {/* Modal de Adicionar Despesa */}
      <AddPublicTripExpenseDialog
        open={isAddExpenseOpen}
        onOpenChange={setIsAddExpenseOpen}
        token={token!}
        members={members}
        defaultPayerId={activeMemberId ?? undefined}
      />

      {/* Modal de Extrato do Participante */}
      <PublicTripMemberStatementDialog
        open={Boolean(selectedMemberForStatement)}
        onOpenChange={(open) => !open && setSelectedMemberForStatement(null)}
        member={selectedMemberForStatement}
        members={members}
        expenses={expenses}
      />

      {/* Modal de Reivindicação de Conta com 1 Clique */}
      <ClaimTripMemberDialog
        open={isClaimDialogOpen}
        onOpenChange={setIsClaimDialogOpen}
        tripTitle={trip.title}
        token={token!}
        tripId={trip.id}
        members={members}
        initialSelectedMemberId={activeMemberId}
        hasPasscode={trip.has_passcode}
        onSuccess={(claimedTripId) => {
          if (activeMemberId) {
            setActiveMemberId(activeMemberId);
          }
          navigate(`/viagens/${claimedTripId}`);
        }}
      />
    </div>
  );
}
