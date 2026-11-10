import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router";
import {
  Receipt,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { SplitChargeCard } from "@/components/modules";
import { usePublicShare } from "@/state/queries/use-public-shares";
import { useCategories, useSaveSplitExpense, useSignalSplitPayment } from "@/state";
import { useAuth } from "@/hooks/use-auth";
import { detectPixKeyType, generatePixBrCode } from "@/domain/pix/pix-br-code";
import { calculateInstallmentsProgress } from "@/domain/finance/split-math";

import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import {
  SelectParticipantDialog,
  SelectSplitCategoryDialog,
  SharedLinkHeaderNav,
  SplitOnboardingModal,
} from "../components";
import type { SplitParticipantItem, SplitSharePayload } from "@/types";

export function SplitPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const saveSplitMutation = useSaveSplitExpense();
  const signalSplitPaymentMutation = useSignalSplitPayment();

  const { data: share, isLoading, error } = usePublicShare(token);

  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isSelectCategoryOpen, setIsSelectCategoryOpen] = useState(false);
  const [isSelectParticipantOpen, setIsSelectParticipantOpen] = useState(false);
  const [participantSelectionIntent, setParticipantSelectionIntent] = useState<"save" | "signal">("save");
  const [selectedParticipant, setSelectedParticipant] = useState<SplitParticipantItem | null>(null);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | null>(null);
  const [isPayAllRemaining, setIsPayAllRemaining] = useState(false);
  const [isSavingDirectly, setIsSavingDirectly] = useState(false);
  const [isSignalingDirectly, setIsSignalingDirectly] = useState(false);
  const [justSignaledInstallmentIds, setJustSignaledInstallmentIds] = useState<Set<string>>(new Set());
  const categoriesQuery = useCategories(session?.user ? "expense" : undefined);

  // Payload tipado com fallback seguro
  const payload = (share?.payload ?? null) as SplitSharePayload | null;

  const participantInstallments = (() => {
    if (!payload?.participant_installments || payload.participant_installments.length === 0) {
      return [];
    }
    if (selectedParticipant?.id) {
      const match = payload.participant_installments.filter(
        (i) => i.participant_id === selectedParticipant.id
      );
      if (match.length > 0) return match;
    }
    const firstGuest = payload.participants?.find((p) => !p.is_host);
    if (firstGuest?.id) {
      const match = payload.participant_installments.filter(
        (i) => i.participant_id === firstGuest.id
      );
      if (match.length > 0) return match;
    }
    return payload.participant_installments;
  })();

  const installmentsProgress =
    participantInstallments.length > 1
      ? calculateInstallmentsProgress(participantInstallments)
      : null;

  const selectedInstallment =
    participantInstallments.length > 1
      ? participantInstallments.find((i) => i.id === selectedInstallmentId) ||
        installmentsProgress?.nextPendingInstallment ||
        participantInstallments[0] ||
        null
      : null;

  const effectiveChargeCents = (() => {
    if (!payload) return 0;
    const guestShareCents =
      selectedParticipant?.share_cents ??
      payload.guest_share_cents ??
      (payload.people_count > 0
        ? Math.round(payload.total_cents / payload.people_count)
        : payload.total_cents);

    if (participantInstallments.length > 1 && installmentsProgress) {
      if (isPayAllRemaining) return installmentsProgress.remainingCents;
      if (selectedInstallment) return selectedInstallment.amount_cents;
    }
    return guestShareCents;
  })();

  const dynamicPixBrCode = (() => {
    if (!payload || !payload.pix_key) return payload?.pix_br_code || "";
    if (participantInstallments.length <= 1) return payload.pix_br_code;

    try {
      const detectedKeyType = detectPixKeyType(payload.pix_key);
      const txSuffix = (token || "RACHA").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
      return generatePixBrCode({
        pixKey: payload.pix_key,
        keyType: detectedKeyType === "unknown" ? undefined : detectedKeyType,
        merchantName: payload.host_name || "Anfitriao",
        merchantCity: payload.host_city || "SAO PAULO",
        amountCents: effectiveChargeCents,
        txId: `RACHA${(selectedInstallment?.installment_number ?? 1).toString().padStart(2, "0")}${txSuffix}`,
        infoAdicional: `${(payload.title || "Racha").slice(0, 15)} ${selectedInstallment && !isPayAllRemaining ? `${selectedInstallment.installment_number}/${selectedInstallment.total_installments}` : ""}`.trim().slice(0, 25),
      });
    } catch {
      return payload.pix_br_code;
    }
  })();

  const hasTriggeredActionRef = useRef(false);

  const executeSaveAndSignal = useCallback(
    async (participant?: SplitParticipantItem | null, categoryId?: string) => {
      if (!payload) return;
      const guestShareCents = effectiveChargeCents;

      setIsSavingDirectly(true);
      try {
        await saveSplitMutation.mutateAsync({
          title: payload.title,
          amountCents: guestShareCents,
          date: payload.date,
          categoryId,
        });

        if (token) {
          try {
            await signalSplitPaymentMutation.mutateAsync({
              token,
              participantName:
                participant?.name ||
                session?.user?.user_metadata?.name ||
                session?.user?.user_metadata?.full_name ||
                session?.user?.email?.split("@")[0] ||
                "Participante",
              amountCents: guestShareCents,
              participantId: participant?.id,
              installmentId: selectedInstallment?.id ?? null,
            });
          } catch (signalErr) {
            console.warn("Nao foi possivel sinalizar o pagamento:", signalErr);
          }
        }

        triggerSensory("success");
        pushToast({
          title: "Despesa registrada!",
          description: "Avisamos o anfitrião sobre o seu pagamento para conferência.",
          variant: "success",
        });
        navigate("/transacoes");
      } catch {
        triggerSensory("destructive");
      } finally {
        setIsSavingDirectly(false);
      }
    },
    [payload, effectiveChargeCents, selectedInstallment, saveSplitMutation, signalSplitPaymentMutation, token, session, navigate],
  );

  const handleSaveExpenseClick = useCallback(async () => {
    if (!payload) return;

    if (!session?.user) {
      setIsOnboardingModalOpen(true);
      return;
    }

    // 1. Identificar participante se houver múltiplos participantes não quitados
    const guestParticipants = (payload.participants ?? []).filter((p) => !p.is_host);
    const unsettledGuests = guestParticipants.filter((p) => !p.is_settled);

    let activeParticipant: SplitParticipantItem | null = selectedParticipant;
    if (!activeParticipant) {
      if (unsettledGuests.length === 1) {
        activeParticipant = unsettledGuests[0] ?? null;
        setSelectedParticipant(activeParticipant);
      } else if (unsettledGuests.length > 1) {
        const userName = (
          session.user.user_metadata?.name ||
          session.user.user_metadata?.full_name ||
          ""
        ).toLowerCase().trim();

        const matched = userName
          ? unsettledGuests.find(
              (p) =>
                p.name.toLowerCase().includes(userName) ||
                userName.includes(p.name.toLowerCase()),
            )
          : null;

        if (matched) {
          activeParticipant = matched;
          setSelectedParticipant(matched);
        } else {
          setParticipantSelectionIntent("save");
          setIsSelectParticipantOpen(true);
          return;
        }
      }
    }

    // 2. Resolver categoria
    const userCategories = categoriesQuery.data ?? [];
    const sentCategoryName = payload.category_name?.trim().toLowerCase();

    let matchedCategory = null;
    if (sentCategoryName && userCategories.length > 0) {
      matchedCategory =
        userCategories.find((c) => c.name.trim().toLowerCase() === sentCategoryName) ||
        userCategories.find(
          (c) =>
            c.name.toLowerCase().includes(sentCategoryName) ||
            sentCategoryName.includes(c.name.toLowerCase()),
        ) ||
        null;
    }

    if (matchedCategory) {
      await executeSaveAndSignal(activeParticipant, matchedCategory.id);
    } else if (userCategories.length > 0) {
      setIsSelectCategoryOpen(true);
    } else {
      await executeSaveAndSignal(activeParticipant);
    }
  }, [
    payload,
    session,
    selectedParticipant,
    categoriesQuery.data,
    executeSaveAndSignal,
  ]);

  const executeSignalOnly = useCallback(
    async (participant?: SplitParticipantItem | null) => {
      if (!payload || !token) return;
      const chargeCents = effectiveChargeCents;
      const targetInstId = selectedInstallment?.id ?? null;

      setIsSignalingDirectly(true);
      try {
        await signalSplitPaymentMutation.mutateAsync({
          token,
          participantName:
            participant?.name ||
            session?.user?.user_metadata?.name ||
            session?.user?.user_metadata?.full_name ||
            session?.user?.email?.split("@")[0] ||
            "Convidado",
          amountCents: chargeCents,
          participantId: participant?.id,
          installmentId: targetInstId,
        });

        if (targetInstId) {
          setJustSignaledInstallmentIds((prev) => new Set(prev).add(targetInstId));
        }

        triggerSensory("success");
        pushToast({
          title: "Aviso enviado ao anfitrião!",
          description: "Notificamos o anfitrião sobre seu pagamento Pix para conferência.",
          variant: "success",
        });
      } catch {
        triggerSensory("destructive");
        pushToast({
          title: "Não foi possível avisar o anfitrião",
          description: "Verifique sua conexão ou tente novamente em instantes.",
          variant: "destructive",
        });
      } finally {
        setIsSignalingDirectly(false);
      }
    },
    [payload, token, effectiveChargeCents, selectedInstallment, session, signalSplitPaymentMutation],
  );

  const handleSignalPixPayment = useCallback(async () => {
    if (!payload || !token) return;

    const guestParticipants = (payload.participants ?? []).filter((p) => !p.is_host);
    const unsettledGuests = guestParticipants.filter((p) => !p.is_settled);

    let activeParticipant: SplitParticipantItem | null = selectedParticipant;
    if (!activeParticipant) {
      if (unsettledGuests.length === 1) {
        activeParticipant = unsettledGuests[0] ?? null;
        setSelectedParticipant(activeParticipant);
      } else if (unsettledGuests.length > 1) {
        setParticipantSelectionIntent("signal");
        setIsSelectParticipantOpen(true);
        return;
      }
    }

    await executeSignalOnly(activeParticipant);
  }, [payload, token, selectedParticipant, executeSignalOnly]);

  const handleConfirmParticipant = useCallback(
    async (participant: SplitParticipantItem) => {
      setSelectedParticipant(participant);
      setIsSelectParticipantOpen(false);

      if (participantSelectionIntent === "signal") {
        await executeSignalOnly(participant);
        return;
      }

      const userCategories = categoriesQuery.data ?? [];
      const sentCategoryName = payload?.category_name?.trim().toLowerCase();

      let matchedCategory = null;
      if (sentCategoryName && userCategories.length > 0) {
        matchedCategory =
          userCategories.find((c) => c.name.trim().toLowerCase() === sentCategoryName) ||
          userCategories.find(
            (c) =>
              c.name.toLowerCase().includes(sentCategoryName) ||
              sentCategoryName.includes(c.name.toLowerCase()),
          ) ||
          null;
      }

      if (matchedCategory) {
        await executeSaveAndSignal(participant, matchedCategory.id);
      } else if (userCategories.length > 0) {
        setIsSelectCategoryOpen(true);
      } else {
        await executeSaveAndSignal(participant);
      }
    },
    [participantSelectionIntent, executeSignalOnly, payload?.category_name, categoriesQuery.data, executeSaveAndSignal],
  );

  const handleConfirmCategorySave = useCallback(
    async (chosenCategoryId: string) => {
      setIsSelectCategoryOpen(false);
      await executeSaveAndSignal(selectedParticipant, chosenCategoryId);
    },
    [executeSaveAndSignal, selectedParticipant],
  );

  useEffect(() => {
    if (payload?.title) {
      document.title = `${payload.title} — Racha de Despesas | Axir`;
    } else {
      document.title = "Racha de Despesa — Axir";
    }
  }, [payload?.title]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "save" && payload && !isLoading && !hasTriggeredActionRef.current) {
      hasTriggeredActionRef.current = true;
      const timer = setTimeout(() => {
        void handleSaveExpenseClick();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, payload, isLoading, handleSaveExpenseClick]);


  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col justify-between pb-8">
      {/* Header Institucional Superior Unificado */}
      <SharedLinkHeaderNav
        badgeLabel="Racha de Conta"
        targetPath={`r/${token || ""}`}
        maxWidth="5xl"
      />

      {/* Conteúdo Central */}
      <main className="w-full max-w-md md:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 flex-1 space-y-6">
        {isLoading ? (
          <Card className="border-border/80 bg-surface shadow-xs p-5 sm:p-6 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </Card>
        ) : error || !share || share.kind !== "split" || !payload ? (
          <Card className="border-border/80 bg-surface shadow-xs p-2">
            <EmptyState
              icon={<Receipt className="size-8 text-muted-foreground" aria-hidden="true" />}
              title="Racha não encontrado ou expirado"
              description="Este link de compartilhamento não está mais disponível, foi revogado pelo organizador ou o endereço acessado está incorreto."
              action={
                <Link to="/apresentacao">
                  <Button variant="default" size="sm" className="gap-2">
                    <span>Conhecer o Axir</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            <SplitChargeCard
              layout="split-desktop"
              title={payload.title || "Racha de Despesa"}
              date={payload.date}
              hostName={payload.host_name || "Anfitrião"}
              peopleCount={payload.people_count}
              totalCents={payload.total_cents}
              guestShareCents={effectiveChargeCents}
              pixBrCode={dynamicPixBrCode}
              pixKey={payload.pix_key}
              pixKeyType={payload.pix_key_type}
              participants={payload.participants}
              installmentsCount={payload.installments_count}
              installments={participantInstallments}
              selectedInstallmentId={selectedInstallment?.id ?? null}
              onSelectInstallmentId={(id) => {
                setIsPayAllRemaining(false);
                setSelectedInstallmentId(id);
              }}
              isPayAllRemaining={isPayAllRemaining}
              onTogglePayAllRemaining={() => setIsPayAllRemaining((prev) => !prev)}
              onSignalPayment={handleSignalPixPayment}
              isSignalingPayment={isSignalingDirectly}
              hasSignaledCurrent={Boolean(
                (selectedInstallment?.id && justSignaledInstallmentIds.has(selectedInstallment.id)) ||
                selectedInstallment?.signal_status === "pending_confirmation" ||
                (!participantInstallments.length && selectedParticipant?.has_payment_signal)
              )}
              desktopExtraContent={
                /* Bloco de Auto-Onboarding & Conversão Viral (Plano 06) */
                <Card className="border-border/80 bg-gradient-to-r from-primary/10 via-surface to-surface shadow-xs p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary shrink-0" aria-hidden="true" />
                      <span className="text-xs font-bold text-foreground">
                        Divida despesas com elegância
                      </span>
                    </div>
                    <Badge variant="muted" size="xs">
                      30 Dias Grátis
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Gostou da facilidade da divisão de contas? Organize suas finanças, cartões, metas e Safe-to-Spend em tempo real sem planilhas complicadas.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 border-border/80 bg-surface font-semibold text-foreground cursor-pointer"
                      onClick={handleSaveExpenseClick}
                      disabled={isSavingDirectly}
                      sensoryIntent="action"
                      aria-label="Salvar esta despesa no meu controle financeiro"
                    >
                      <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                      <span>
                        {isSavingDirectly
                          ? "Salvando despesa…"
                          : "Salvar esta despesa"}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1 gap-1.5 font-semibold cursor-pointer"
                      onClick={() => navigate("/cadastrar?ref=split")}
                    >
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                      <span>Testar 30 dias grátis</span>
                    </Button>
                  </div>
                </Card>
              }
            />

            <SplitOnboardingModal
              open={isOnboardingModalOpen}
              onOpenChange={setIsOnboardingModalOpen}
              guestShareCents={effectiveChargeCents}
              title={payload.title}
              date={payload.date}
              token={token || ""}
            />

            <SelectSplitCategoryDialog
              open={isSelectCategoryOpen}
              onOpenChange={setIsSelectCategoryOpen}
              title={payload.title}
              amountCents={effectiveChargeCents}
              sentCategoryName={payload.category_name}
              categories={categoriesQuery.data ?? []}
              isPending={isSavingDirectly}
              onConfirm={handleConfirmCategorySave}
            />

            <SelectParticipantDialog
              open={isSelectParticipantOpen}
              onOpenChange={setIsSelectParticipantOpen}
              participants={(payload.participants ?? []).filter((p) => !p.is_host && !p.is_settled)}
              isPending={isSavingDirectly}
              onConfirm={handleConfirmParticipant}
            />
          </div>
        )}
      </main>

      {/* Rodapé Institucional */}
      <footer className="w-full max-w-md md:max-w-5xl mx-auto pt-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
          <span>Ambiente Seguro · Padrão BACEN EMV QRCPS</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Estruturado via{" "}
          <Link to="/apresentacao" className="text-primary hover:underline font-medium">
            Axir
          </Link>{" "}
          · Gestão Financeira Pessoal & Automação
        </p>
      </footer>
    </div>
  );
}
