import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Plus, Receipt } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Skeleton,
  Tabs,
  buttonVariants,
} from "@/components/ui";
import { usePublicTrip, useUserTrips } from "@/state/queries/use-trips";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeShareToken } from "@/domain/share/token";
import { cn } from "@/lib/utils";
import {
  AddPublicTripExpenseDialog,
  ClaimTripMemberDialog,
  PublicTripIdentityBanner,
  PublicTripMemberStatementDialog,
  SharedLinkHeaderNav,
} from "../components";
import { PublicTripHeroCard } from "../components/public-trip-hero-card";
import { PublicTripExpensesList } from "../components/public-trip-expenses-list";
import { PublicTripSettlementsCard } from "../components/public-trip-settlements-card";
import { PublicTripStatusBanners } from "../components/public-trip-status-banners";
import { buildTripWhatsAppShareUrl } from "../hooks/trip-whatsapp-share";
import { usePublicTripGuestIdentity } from "../hooks";
import type { PublicTripMember } from "@/types/trips";

export function TripPublicPage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const token = sanitizeShareToken(rawToken);
  const navigate = useNavigate();
  const { session } = useAuth();
  const currentUser = session?.user;
  const { data: userTrips } = useUserTrips();

  const { data, isLoading, error } = usePublicTrip(token);
  const { activeMemberId, setActiveMemberId } = usePublicTripGuestIdentity(token);

  const [activeTab, setActiveTab] = useState<string>("expenses");
  const [selectedMemberForStatement, setSelectedMemberForStatement] =
    useState<PublicTripMember | null>(null);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);

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
        <div className="w-full max-w-md space-y-4">
          <EmptyState
            icon={<Receipt className="size-8 text-muted-foreground" aria-hidden="true" />}
            title="Viagem não encontrada"
            description="O link informado pode ter expirado, sido removido ou o código de acesso está incorreto."
            action={
              <Link
                to="/"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto")}
              >
                Ir para a página inicial
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const { trip, members, expenses, balances, suggestedSettlements, totalExpensesCents } = data;
  const isAlreadyLinked = Boolean(
    currentUser && userTrips?.some((t) => t.id === trip.id || t.public_token === token),
  );
  const claimableMembers = members.filter((m) => !m.has_axis_account);
  const canClaimAccount = Boolean(currentUser && !isAlreadyLinked && claimableMembers.length > 0);
  const currentBalance = activeMemberId
    ? balances.find((b) => b.memberId === activeMemberId) ?? null
    : null;

  const handleShareWhatsApp = () => {
    const shareUrl = buildTripWhatsAppShareUrl(trip, totalExpensesCents, suggestedSettlements);
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-16">
      <SharedLinkHeaderNav
        badgeLabel="Modo Viagem"
        targetPath={`viagem/${token ?? ""}`}
        maxWidth="5xl"
      />

      <main className="flex-1 w-full max-w-2xl md:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pt-4 space-y-4">
        <PublicTripStatusBanners
          trip={trip}
          isAlreadyLinked={isAlreadyLinked}
          isAuthenticated={Boolean(currentUser)}
        />

        <PublicTripHeroCard
          trip={trip}
          totalExpensesCents={totalExpensesCents}
          onShareWhatsApp={handleShareWhatsApp}
          onOpenAddExpense={() => setIsAddExpenseOpen(true)}
        />

        <PublicTripIdentityBanner
          token={token!}
          members={members}
          activeMemberId={activeMemberId}
          onSelectMember={setActiveMemberId}
          balance={currentBalance}
          onOpenStatement={setSelectedMemberForStatement}
          onClaimAccount={canClaimAccount ? () => setIsClaimDialogOpen(true) : undefined}
        />

        <div className="md:hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            items={[
              { value: "expenses", label: `Despesas (${expenses.length})` },
              { value: "settlements", label: `Acerto de Contas (${suggestedSettlements.length})` },
            ]}
            variant="pills"
            fullWidth
          />
        </div>

        <div className="md:grid md:grid-cols-12 md:gap-6 items-start">
          <div className={cn("space-y-4 md:col-span-7", activeTab !== "expenses" && "hidden md:block")}>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Extrato de Despesas ({expenses.length})
                </h2>
                {trip.status !== "completed" && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => setIsAddExpenseOpen(true)}
                    className="text-xs gap-1"
                  >
                    <Plus className="size-3" aria-hidden="true" />
                    <span>Lançar Gasto</span>
                  </Button>
                )}
              </div>
              <PublicTripExpensesList expenses={expenses} members={members} />
            </div>
          </div>

          <div
            className={cn(
              "space-y-4 md:col-span-5 md:sticky md:top-20",
              activeTab !== "settlements" && "hidden md:block",
            )}
          >
            <PublicTripSettlementsCard trip={trip} suggestedSettlements={suggestedSettlements} />
          </div>
        </div>

        <Card className="border-border/80 bg-surface shadow-xs rounded-2xl p-4 sm:p-5 text-center space-y-2.5 mt-6">
          <p className="text-xs font-semibold text-foreground">
            Gostou da organização desta viagem?
          </p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            O Axir é um aplicativo completo de finanças pessoais, cartões, despesas compartilhadas e projeção.
          </p>
          <div className="pt-1">
            <Link
              to="/cadastro"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "gap-1.5 text-xs font-medium inline-flex",
              )}
            >
              <span>Criar minha conta gratuita</span>
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      </main>

      <AddPublicTripExpenseDialog
        open={isAddExpenseOpen}
        onOpenChange={setIsAddExpenseOpen}
        token={token!}
        members={members}
        defaultPayerId={activeMemberId ?? undefined}
      />

      <PublicTripMemberStatementDialog
        open={Boolean(selectedMemberForStatement)}
        onOpenChange={(open) => !open && setSelectedMemberForStatement(null)}
        member={selectedMemberForStatement}
        members={members}
        expenses={expenses}
      />

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
          if (activeMemberId) setActiveMemberId(activeMemberId);
          navigate(`/viagens/${claimedTripId}`);
        }}
      />
    </div>
  );
}
