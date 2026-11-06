import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router";
import {
  Check,
  Copy,
  QrCode,
  Receipt,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  User,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  MoneyText,
  Skeleton,
  QrCodeCanvas,
} from "@/components/ui";
import { usePublicShare } from "@/state/queries/use-public-shares";
import { useCategories, useSaveSplitExpense, useSignalSplitPayment } from "@/state";
import { useAuth } from "@/hooks/use-auth";
import { formatCentsAsCurrency } from "@/services/masks";
import { formatDateBR } from "@/lib/date";
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

  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isSelectCategoryOpen, setIsSelectCategoryOpen] = useState(false);
  const [isSelectParticipantOpen, setIsSelectParticipantOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<SplitParticipantItem | null>(null);
  const [isSavingDirectly, setIsSavingDirectly] = useState(false);
  const categoriesQuery = useCategories(session?.user ? "expense" : undefined);

  // Payload tipado com fallback seguro
  const payload = (share?.payload ?? null) as SplitSharePayload | null;

  const hasTriggeredActionRef = useRef(false);

  const executeSaveAndSignal = useCallback(
    async (participant?: SplitParticipantItem | null, categoryId?: string) => {
      if (!payload) return;
      const guestShareCents =
        participant?.share_cents ??
        payload.guest_share_cents ??
        (payload.people_count > 0
          ? Math.round(payload.total_cents / payload.people_count)
          : payload.total_cents);

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
    [payload, saveSplitMutation, signalSplitPaymentMutation, token, session, navigate],
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

  const handleConfirmParticipant = useCallback(
    async (participant: SplitParticipantItem) => {
      setSelectedParticipant(participant);
      setIsSelectParticipantOpen(false);

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
    [payload?.category_name, categoriesQuery.data, executeSaveAndSignal],
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
      document.title = `${payload.title} — Racha de Despesas | Áxis Finance`;
    } else {
      document.title = "Racha de Despesa — Áxis Finance";
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

  const handleCopyPix = async () => {
    if (!payload?.pix_br_code) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload.pix_br_code);
        setCopiedPix(true);
        pushToast({
          title: "Código Pix copiado!",
          description: "Abra o aplicativo do seu banco para colar e pagar.",
          variant: "success",
        });
        setTimeout(() => setCopiedPix(false), 3000);
      }
    } catch {
      pushToast({
        title: "Não foi possível copiar automaticamente.",
        description: "Selecione e copie o código Pix manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleCopyPixKey = async () => {
    if (!payload?.pix_key) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload.pix_key);
        setCopiedKey(true);
        pushToast({
          title: "Chave Pix copiada!",
          description: "Chave direta copiada para a área de transferência.",
          variant: "default",
        });
        setTimeout(() => setCopiedKey(false), 3000);
      }
    } catch {
      pushToast({
        title: "Não foi possível copiar a chave.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Header Institucional Superior Unificado */}
      <div className="w-full max-w-md mx-auto pb-4">
        <SharedLinkHeaderNav
          badgeLabel="Racha de Conta"
          targetPath={`r/${token || ""}`}
        />
      </div>

      {/* Conteúdo Central */}
      <main className="w-full max-w-md mx-auto my-auto space-y-4">
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
                    <span>Conhecer o Áxis Finance</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          (() => {
            const guestShareCents =
              payload.guest_share_cents ??
              (payload.people_count > 0
                ? Math.round(payload.total_cents / payload.people_count)
                : payload.total_cents);

            return (
              <div className="space-y-4">
                <Card className="border-border/80 bg-surface shadow-xs">
                  <CardHeader className="p-5 sm:p-6 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="default" size="xs" className="gap-1">
                        <Receipt className="size-3 text-muted-foreground" aria-hidden="true" />
                        <span>Despesa Compartilhada</span>
                      </Badge>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>{formatDateBR(payload.date)}</span>
                      </div>
                    </div>

                    <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-2">
                      {payload.title || "Racha de Despesa"}
                    </CardTitle>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                      <div className="flex items-center gap-1.5">
                        <User className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>Por: <strong className="font-semibold text-foreground">{payload.host_name || "Anfitrião"}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>{payload.people_count} participantes</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
                    {/* Bloco Hero: Sua Parte a Pagar */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-center space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Sua parte a pagar
                      </span>
                      <div className="tabular-nums font-bold text-foreground text-3xl sm:text-4xl tracking-tight whitespace-nowrap">
                        <MoneyText cents={guestShareCents} variant="hero" />
                      </div>
                      <span className="text-xs text-muted-foreground block">
                        Valor total da conta: {formatCentsAsCurrency(payload.total_cents)}
                      </span>
                    </div>

                    {/* Botão de Um Toque: Copiar Pix com Valor Embutido */}
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      className="w-full gap-2 text-base font-semibold shadow-sm cursor-pointer"
                      onClick={handleCopyPix}
                      sensoryIntent="success"
                      aria-label={`Copiar código Pix no valor de ${formatCentsAsCurrency(guestShareCents)}`}
                    >
                      {copiedPix ? (
                        <>
                          <Check className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
                          <span>Código Pix Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-5 shrink-0" aria-hidden="true" />
                          <span>Copiar Pix — {formatCentsAsCurrency(guestShareCents)}</span>
                        </>
                      )}
                    </Button>

                    {/* Toggle Opcional: QR Code Pix Canvas Client-Side */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQrCode((prev) => !prev)}
                      className="w-full gap-2 border-border/80 bg-surface cursor-pointer"
                      aria-expanded={showQrCode}
                      aria-label={showQrCode ? "Ocultar QR Code Pix" : "Exibir QR Code Pix"}
                    >
                      <QrCode className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span>{showQrCode ? "Ocultar QR Code" : "Exibir QR Code Pix"}</span>
                    </Button>


                    {/* Bloco Condicional de QR Code em Canvas */}
                    {showQrCode && (
                      <div className="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col items-center gap-3 text-center">
                        <p className="text-xs text-muted-foreground">
                          Abra o app do seu banco, escolha <strong>Pagar com QR Code</strong> e aponte para a tela:
                        </p>
                        <QrCodeCanvas
                          text={payload.pix_br_code}
                          size={180}
                          label="Código QR Pix oficial"
                        />
                        <div className="w-full pt-2 border-t border-border/60 flex flex-col items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">
                            Chave Pix ({payload.pix_key_type || "cadastrada"}):
                          </span>
                          <div className="flex items-center gap-2 max-w-full">
                            <code className="text-xs font-mono bg-surface px-2 py-1 rounded border border-border/60 text-foreground truncate max-w-[160px] sm:max-w-[240px]">
                              {payload.pix_key}
                            </code>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={handleCopyPixKey}
                              className="gap-1 border-border/80 bg-surface cursor-pointer shrink-0"
                              aria-label="Copiar chave Pix diretamente"
                            >
                              {copiedKey ? (
                                <Check className="size-3 text-positive-strong" aria-hidden="true" />
                              ) : (
                                <Copy className="size-3 text-muted-foreground" aria-hidden="true" />
                              )}
                              <span>{copiedKey ? "Copiada" : "Copiar"}</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lista de Participantes (se discriminados) */}
                    {payload.participants && payload.participants.length > 1 && (
                      <div className="pt-2 border-t border-border/60 space-y-2">
                        <span className="text-xs font-semibold text-muted-foreground block">
                          Divisão entre os participantes
                        </span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                          {payload.participants.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-background/40 border border-border/40"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-foreground truncate font-medium">
                                  {item.name}
                                </span>
                                {item.is_host && (
                                  <Badge variant="muted" size="xs">
                                    Anfitrião
                                  </Badge>
                                )}
                              </div>
                              <span className="tabular-nums font-semibold text-foreground shrink-0 ml-2">
                                {formatCentsAsCurrency(item.share_cents)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Bloco de Auto-Onboarding (Tarefa 2.3) */}
                <Card className="border-border/80 bg-gradient-to-r from-primary/10 via-surface to-surface shadow-xs p-4 sm:p-5 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary shrink-0" aria-hidden="true" />
                    <span className="text-xs font-bold text-foreground">
                      Controle financeiro pessoal inteligente
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gostou da facilidade do racha? Organize suas contas, metas e gastos diários sem planilhas complicadas.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-border/80 bg-surface font-semibold text-foreground cursor-pointer"
                    onClick={handleSaveExpenseClick}
                    disabled={isSavingDirectly}
                    sensoryIntent="action"
                    aria-label="Salvar esta despesa no meu controle financeiro"
                  >
                    <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                    <span>
                      {isSavingDirectly
                        ? "Salvando despesa…"
                        : "Salvar esta despesa no meu controle financeiro"}
                    </span>
                  </Button>
                </Card>

                <SplitOnboardingModal
                  open={isOnboardingModalOpen}
                  onOpenChange={setIsOnboardingModalOpen}
                  guestShareCents={guestShareCents}
                  title={payload.title}
                  date={payload.date}
                  token={token || ""}
                />

                <SelectSplitCategoryDialog
                  open={isSelectCategoryOpen}
                  onOpenChange={setIsSelectCategoryOpen}
                  title={payload.title}
                  amountCents={guestShareCents}
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
            );
          })()
        )}
      </main>

      {/* Rodapé Institucional */}
      <footer className="w-full max-w-md mx-auto pt-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
          <span>Ambiente Seguro · Padrão BACEN EMV QRCPS</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Estruturado via{" "}
          <Link to="/apresentacao" className="text-primary hover:underline font-medium">
            Áxis Finance
          </Link>{" "}
          · Gestão Financeira Pessoal & Automação
        </p>
      </footer>
    </div>
  );
}
