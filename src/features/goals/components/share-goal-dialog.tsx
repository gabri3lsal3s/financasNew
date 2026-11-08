import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  QrCode,
  RotateCw,
  Share2,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  DatePicker,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
  QrCodeCanvas,
  Select,
  Switch,
  type SelectOption,
} from "@/components/ui";
import {
  detectPixKeyType,
  generatePixBrCode,
  type PixKeyType,
} from "@/domain/pix/pix-br-code";
import { useUserAccess } from "@/state/queries/use-user-access";
import { useMyPublicShares } from "@/state/queries/use-public-shares";
import {
  useCreatePublicShare,
  useDeletePublicShare,
  useRegeneratePublicShare,
  useRestorePublicShare,
  useRevokePublicShare,
  useUpdatePublicShare,
} from "@/state/mutations/use-public-share-mutations";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getPublicAppUrl } from "@/services/app-url";
import type { Category, GoalTrackerSharePayload, GoalTrackerStatus, PublicShare } from "@/types";

export interface ShareGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  existingShare?: PublicShare | null;
  month?: string;
  currentExpectedCents?: number;
  currentRealizedCents?: number;
  initialEditMode?: boolean;
}

const PIX_KEY_OPTIONS: SelectOption[] = [
  { value: "auto", label: "Detecção automática" },
  { value: "cpf", label: "CPF" },
  { value: "phone", label: "Celular (+55)" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave Aleatória (EVP)" },
  { value: "cnpj", label: "CNPJ" },
];

export function ShareGoalDialog({
  open,
  onOpenChange,
  category,
  existingShare,
  month = new Date().toISOString().slice(0, 7),
  currentExpectedCents = 0,
  currentRealizedCents = 0,
  initialEditMode = false,
}: ShareGoalDialogProps) {
  const { profile } = useUserAccess();
  const { data: myShares } = useMyPublicShares("goal_tracker");
  const createPublicShareMutation = useCreatePublicShare();
  const updatePublicShareMutation = useUpdatePublicShare();
  const revokePublicShareMutation = useRevokePublicShare();
  const restorePublicShareMutation = useRestorePublicShare();
  const deletePublicShareMutation = useDeletePublicShare();
  const regeneratePublicShareMutation = useRegeneratePublicShare();

  const [nowMs] = useState(() => Date.now());

  // Localiza link ativo prévio para a mesma categoria ou usa existingShare direto
  const activeShare = useMemo(() => {
    if (existingShare) return existingShare;
    if (!category) return undefined;
    return (myShares ?? []).find(
      (s) =>
        !s.is_revoked &&
        (!s.expires_at || new Date(s.expires_at).getTime() > nowMs) &&
        s.payload?.category_id === category.id,
    );
  }, [existingShare, myShares, category, nowMs]);

  const profileDefaultPix = profile?.cpf || profile?.email || "";
  const profileDefaultName = profile?.name || "Organizador";

  // Modo de edição caso activeShare já exista
  const [isEditingGoal, setIsEditingGoal] = useState(() => Boolean(initialEditMode || !activeShare));

  // Campos do formulário
  const [title, setTitle] = useState(() => (activeShare?.payload?.title as string) || category?.name || "");
  const [targetCents, setTargetCents] = useState<number>(() => {
    if (activeShare?.payload?.target_cents) {
      return Number(activeShare.payload.target_cents);
    }
    return currentExpectedCents > 0 ? currentExpectedCents : 100000;
  });
  const [initialCollectedCents, setInitialCollectedCents] = useState<number>(() => {
    if (activeShare?.payload?.current_cents !== undefined) {
      return Number(activeShare.payload.current_cents);
    }
    return currentRealizedCents;
  });
  const [deadline, setDeadline] = useState<string>(() => (activeShare?.payload?.deadline as string) || "");
  const [pixKey, setPixKey] = useState<string>(() => (activeShare?.payload?.pix_key as string) || profileDefaultPix);
  const [selectedKeyType, setSelectedKeyType] = useState<string>(() => (activeShare?.payload?.pix_key_type as string) || "auto");
  const [merchantName, setMerchantName] = useState<string>(() => (activeShare?.payload?.organizer_name as string) || profileDefaultName);
  const [merchantCity, setMerchantCity] = useState<string>(() => (activeShare?.payload?.organizer_city as string) || "SAO PAULO");
  const [showContributionsPublicly, setShowContributionsPublicly] = useState<boolean>(() => {
    if (activeShare?.payload?.show_contributions_publicly !== undefined) {
      return Boolean(activeShare.payload.show_contributions_publicly);
    }
    return true;
  });

  const [copied, setCopied] = useState(false);
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const shareUrl = activeShare ? getPublicAppUrl(`meta/${activeShare.token}`) : "";

  // Pré-computação segura do Pix BACEN
  const effectivePixBrCode = useMemo(() => {
    if (!pixKey.trim()) return "";
    try {
      const detected = detectPixKeyType(pixKey);
      const keyType =
        selectedKeyType === "auto"
          ? (detected !== "unknown" ? detected : undefined)
          : (selectedKeyType as PixKeyType);

      return generatePixBrCode({
        pixKey: pixKey.trim(),
        keyType,
        merchantName: merchantName.trim() || "Organizador",
        merchantCity: merchantCity.trim() || "SAO PAULO",
        txId: "***",
      });
    } catch {
      return "";
    }
  }, [pixKey, selectedKeyType, merchantName, merchantCity]);

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopied(true);
      triggerSensory("action");
      pushToast({
        title: "Link público copiado!",
        description: "Compartilhe com o grupo para acompanhar o progresso da meta.",
        variant: "default",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      pushToast({
        title: "Não foi possível copiar o link",
        variant: "destructive",
      });
    }
  };

  const handleOpenPublicPage = () => {
    if (shareUrl && typeof window !== "undefined") {
      triggerSensory("action");
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pixKey.trim() || targetCents <= 0) return;

    try {
      const detected = detectPixKeyType(pixKey);
      const keyType =
        selectedKeyType === "auto"
          ? (detected !== "unknown" ? detected : undefined)
          : (selectedKeyType as PixKeyType);

      const brCode =
        effectivePixBrCode ||
        generatePixBrCode({
          pixKey: pixKey.trim(),
          keyType,
          merchantName: merchantName.trim() || "Organizador",
          merchantCity: merchantCity.trim() || "SAO PAULO",
          txId: "***",
        });

      const payload: GoalTrackerSharePayload = {
        title: title.trim() || category?.name || "Meta Coletiva",
        category_id: category?.id ?? null,
        month,
        target_cents: targetCents,
        current_cents: initialCollectedCents,
        deadline: deadline.trim() || null,
        organizer_name: merchantName.trim() || "Organizador",
        organizer_city: merchantCity.trim() || "SAO PAULO",
        pix_key: pixKey.trim(),
        pix_key_type: keyType ?? "unknown",
        pix_br_code: brCode,
        status: "active",
        show_contributions_publicly: showContributionsPublicly,
      };

      const result = await createPublicShareMutation.mutateAsync({
        kind: "goal_tracker",
        payload: payload as unknown as Record<string, unknown>,
      });

      const generatedUrl = getPublicAppUrl(`meta/${result.token}`);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedUrl).catch(() => {});
      }

      triggerSensory("action");
      pushToast({
        title: "Termômetro público ativado com sucesso!",
        description: "O link foi copiado para sua área de transferência.",
        variant: "success",
      });
    } catch (err) {
      triggerSensory("destructive");
      pushToast({
        title: "Erro ao gerar termômetro público",
        description: err instanceof Error ? err.message : "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  const handleSaveGoalChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShare || !pixKey.trim() || targetCents <= 0) return;

    try {
      const detected = detectPixKeyType(pixKey);
      const keyType =
        selectedKeyType === "auto"
          ? (detected !== "unknown" ? detected : undefined)
          : (selectedKeyType as PixKeyType);

      const brCode =
        effectivePixBrCode ||
        generatePixBrCode({
          pixKey: pixKey.trim(),
          keyType,
          merchantName: merchantName.trim() || "Organizador",
          merchantCity: merchantCity.trim() || "SAO PAULO",
          txId: "***",
        });

      const updatedPayload: GoalTrackerSharePayload = {
        ...activeShare.payload,
        title: title.trim() || "Meta Coletiva",
        target_cents: targetCents,
        current_cents: initialCollectedCents,
        deadline: deadline.trim() || null,
        organizer_name: merchantName.trim() || "Organizador",
        organizer_city: merchantCity.trim() || "SAO PAULO",
        pix_key: pixKey.trim(),
        pix_key_type: keyType ?? "unknown",
        pix_br_code: brCode,
        show_contributions_publicly: showContributionsPublicly,
      };

      await updatePublicShareMutation.mutateAsync({
        id: activeShare.id,
        payload: updatedPayload as unknown as Record<string, unknown>,
      });

      setIsEditingGoal(false);
      triggerSensory("action");
      pushToast({
        title: "Dados da meta atualizados!",
        description: "As alterações já estão ativas e refletidas no link público.",
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Erro ao salvar alterações da meta",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmRevoke = async () => {
    if (!activeShare) return;
    try {
      await revokePublicShareMutation.mutateAsync(activeShare.id);
      setIsRevokeModalOpen(false);
      triggerSensory("action");
      pushToast({
        title: "Link do termômetro pausado.",
        description: "A página pública agora exibe aviso de link inativo. Você pode reativar quando desejar.",
        variant: "default",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleConfirmRestore = async () => {
    if (!activeShare) return;
    try {
      await restorePublicShareMutation.mutateAsync(activeShare.id);
      triggerSensory("action");
      pushToast({
        title: "Link público reativado com sucesso!",
        description: "A arrecadação pública volta a estar acessível.",
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleConfirmDelete = async () => {
    if (!activeShare) return;
    try {
      await deletePublicShareMutation.mutateAsync(activeShare.id);
      setIsDeleteModalOpen(false);
      onOpenChange(false);
      triggerSensory("action");
      pushToast({
        title: "Meta excluída com sucesso!",
        description: "A meta coletiva e seus registros foram removidos definitivamente.",
        variant: "default",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  const isCompleted = activeShare?.payload?.status === "completed";

  const handleToggleStatus = async () => {
    if (!activeShare) return;
    try {
      const nextStatus: GoalTrackerStatus = isCompleted ? "active" : "completed";
      await updatePublicShareMutation.mutateAsync({
        id: activeShare.id,
        payload: {
          ...activeShare.payload,
          status: nextStatus,
        },
      });
      triggerSensory("action");
      pushToast({
        title: nextStatus === "completed" ? "Meta marcada como concluída!" : "Meta reaberta como ativa!",
        description:
          nextStatus === "completed"
            ? "O termômetro web agora exibe aviso de meta conquistada com sucesso."
            : "A arrecadação foi reativada.",
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleConfirmRegenerate = async () => {
    if (!activeShare) return;
    try {
      const detected = detectPixKeyType(pixKey);
      const keyType =
        selectedKeyType === "auto"
          ? (detected !== "unknown" ? detected : undefined)
          : (selectedKeyType as PixKeyType);

      const brCode =
        effectivePixBrCode ||
        generatePixBrCode({
          pixKey: pixKey.trim(),
          keyType,
          merchantName: merchantName.trim() || "Organizador",
          merchantCity: merchantCity.trim() || "SAO PAULO",
          txId: "***",
        });

      const payload: GoalTrackerSharePayload = {
        ...activeShare.payload,
        title: title.trim() || category?.name || "Meta Coletiva",
        target_cents: targetCents,
        current_cents: initialCollectedCents,
        deadline: deadline.trim() || null,
        organizer_name: merchantName.trim() || "Organizador",
        organizer_city: merchantCity.trim() || "SAO PAULO",
        pix_key: pixKey.trim(),
        pix_key_type: keyType ?? "unknown",
        pix_br_code: brCode,
        status: (activeShare.payload?.status as GoalTrackerStatus) || "active",
        show_contributions_publicly: showContributionsPublicly,
      };

      const result = await regeneratePublicShareMutation.mutateAsync({
        oldId: activeShare.id,
        input: {
          kind: "goal_tracker",
          payload: payload as unknown as Record<string, unknown>,
        },
      });

      setIsRegenerateModalOpen(false);
      const generatedUrl = getPublicAppUrl(`meta/${result.token}`);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedUrl).catch(() => {});
      }

      triggerSensory("action");
      pushToast({
        title: "Link regenerado com sucesso!",
        description: "Novo endereço copiado para a área de transferência.",
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  const isPending =
    createPublicShareMutation.isPending ||
    updatePublicShareMutation.isPending ||
    revokePublicShareMutation.isPending ||
    restorePublicShareMutation.isPending ||
    deletePublicShareMutation.isPending ||
    regeneratePublicShareMutation.isPending;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={activeShare ? "Gerenciar Termômetro da Meta" : "Compartilhar Progresso da Meta"}
        description={
          activeShare
            ? "Edite os dados da meta, ajuste a chave Pix e controle a visibilidade das doações."
            : "Gere um termômetro público transparente com Pix para arrecadação coletiva."
        }
        size="lg"
      >
        {activeShare && !isEditingGoal ? (
          <div className="flex flex-col gap-5 py-2">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {activeShare.is_revoked ? (
                    <Badge variant="warning" size="sm" className="gap-1">
                      <EyeOff className="size-3.5" aria-hidden="true" />
                      <span>Link Público Pausado</span>
                    </Badge>
                  ) : (
                    <Badge variant="default" size="sm" className="gap-1 border border-primary/40 text-primary">
                      <Share2 className="size-3.5" aria-hidden="true" />
                      <span>Termômetro Público Ativo</span>
                    </Badge>
                  )}
                  {isCompleted && (
                    <Badge variant="positive" size="xs">
                      Concluída
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      triggerSensory("action");
                      setIsEditingGoal(true);
                    }}
                    className="gap-1.5 text-xs border-border/80 bg-surface hover:bg-surface-hover"
                  >
                    <Edit2 className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span>Editar Meta</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenPublicPage}
                    className="gap-1.5 text-xs text-primary hover:text-primary-strong"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    <span>Abrir página</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-foreground">
                  {String(activeShare.payload?.title || category?.name || "Meta Coletiva")}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <span>Alvo:</span>
                    <MoneyText
                      cents={Number(activeShare.payload?.target_cents || targetCents)}
                      tone="default"
                      className="font-medium text-foreground"
                    />
                  </span>
                  {activeShare.payload?.deadline ? (
                    <span>Data Alvo: {String(activeShare.payload.deadline)}</span>
                  ) : null}
                  <span>Chave Pix: {String(activeShare.payload?.pix_key || pixKey)}</span>
                  <span className="flex items-center gap-1">
                    {showContributionsPublicly ? (
                      <>
                        <Eye className="size-3 text-positive-strong" aria-hidden="true" />
                        <span>Doações visíveis publicamente</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-3 text-muted-foreground" aria-hidden="true" />
                        <span>Doações ocultas publicamente</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Caixa de Cópia do Link */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="goal-share-link" className="text-xs font-semibold text-foreground">
                Link de Acesso Público
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="goal-share-link"
                  readOnly
                  value={shareUrl}
                  className="font-mono text-xs select-all bg-muted/40"
                  aria-label="Link público do termômetro de meta"
                />
                <Button
                  type="button"
                  variant={copied ? "default" : "outline"}
                  onClick={() => void handleCopyLink()}
                  className="shrink-0 gap-1.5"
                  aria-label="Copiar link do termômetro"
                >
                  {copied ? (
                    <>
                      <Check className="size-4" aria-hidden="true" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" aria-hidden="true" />
                      <span>Copiar Link</span>
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Qualquer pessoa com este link pode acompanhar o termômetro e copiar a chave Pix.
              </p>
            </div>

            {/* Alternância do QR Code de Arrecadação */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs font-medium text-foreground">QR Code Pix para Arrecadação</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowQrPreview((prev) => !prev)}
                >
                  {showQrPreview ? "Ocultar" : "Visualizar"}
                </Button>
              </div>

              {showQrPreview && (
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg border border-border/60 self-center">
                  <QrCodeCanvas
                    text={String(activeShare.payload?.pix_br_code || effectivePixBrCode)}
                    size={180}
                    label="QR Code Pix do Organizador"
                  />
                  <p className="mt-2 text-[10px] text-slate-500 font-medium">
                    Pix Padrão Banco Central (EMV QRCPS-MPM)
                  </p>
                </div>
              )}
            </div>

            <ModalFooter borderless className="block w-full [&_button]:sm:min-w-0 p-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 w-full">
                {/* Grupo de Ações Secundárias / Administrativas (à esquerda no desktop, segunda linha no mobile) */}
                <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto order-last sm:order-first pt-2 sm:pt-0 border-t border-border/60 sm:border-t-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Excluir meta"
                    title="Excluir meta"
                    className="text-critical hover:text-critical hover:bg-critical/10 text-xs px-2 sm:px-2.5 h-8 gap-1.5 justify-center"
                    onClick={() => setIsDeleteModalOpen(true)}
                    disabled={isPending}
                  >
                    <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="hidden min-[400px]:inline">Excluir</span>
                  </Button>
                  {activeShare.is_revoked ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Reativar link público"
                      title="Reativar link público"
                      onClick={() => void handleConfirmRestore()}
                      disabled={isPending}
                      className="gap-1.5 text-xs px-2 sm:px-2.5 h-8 justify-center"
                    >
                      <Eye className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="hidden min-[400px]:inline">Reativar<span className="hidden md:inline"> link</span></span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Pausar link público"
                      title="Pausar link público"
                      className="text-muted-foreground hover:text-foreground text-xs px-2 sm:px-2.5 h-8 gap-1.5 justify-center"
                      onClick={() => setIsRevokeModalOpen(true)}
                      disabled={isPending}
                    >
                      <EyeOff className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="hidden min-[400px]:inline">Pausar<span className="hidden md:inline"> link</span></span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Regenerar link público"
                    title="Regenerar link público"
                    onClick={() => setIsRegenerateModalOpen(true)}
                    disabled={isPending}
                    className="text-xs px-2 sm:px-2.5 h-8 gap-1.5 text-muted-foreground hover:text-foreground justify-center"
                  >
                    <RotateCw className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="hidden min-[400px]:inline">Regenerar<span className="hidden md:inline"> link</span></span>
                  </Button>
                </div>

                {/* Grupo de Ações Primárias / Diálogo (à direita no desktop, primeira linha no mobile) */}
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto order-first sm:order-last">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="h-8 text-xs px-3"
                  >
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    aria-label={isCompleted ? "Reabrir meta" : "Marcar como concluída"}
                    title={isCompleted ? "Reabrir meta" : "Marcar como concluída"}
                    onClick={() => void handleToggleStatus()}
                    disabled={isPending}
                    className="gap-1.5 h-8 text-xs font-semibold px-3"
                  >
                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="hidden min-[380px]:inline">{isCompleted ? "Reabrir Meta" : "Concluir Meta"}</span>
                    <span className="min-[380px]:hidden">{isCompleted ? "Reabrir" : "Concluir"}</span>
                  </Button>
                </div>
              </div>
            </ModalFooter>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              if (activeShare && isEditingGoal) {
                void handleSaveGoalChanges(e);
              } else {
                void handleCreateShare(e);
              }
            }}
            className="flex flex-col gap-4 py-2"
          >
            {activeShare && isEditingGoal && (
              <div className="flex items-center justify-between pb-1 border-b border-border/60">
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Edit2 className="size-3.5" aria-hidden="true" />
                  <span>Editando Parâmetros da Meta</span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingGoal(false)}
                  className="text-xs text-muted-foreground"
                >
                  Cancelar Edição
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Título da Meta */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-title" className="text-xs font-semibold text-foreground">
                  Título da Meta
                </label>
                <Input
                  id="goal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Viagem de Fim de Ano"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Identificação exibida no topo da página pública.
                </p>
              </div>

              {/* Alvo da Arrecadação */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-target-amount" className="text-xs font-semibold text-foreground">
                  Valor Alvo (Total pretendido)
                </label>
                <MoneyInput
                  id="goal-target-amount"
                  cents={targetCents}
                  onCentsChange={setTargetCents}
                  placeholder="Ex.: R$ 6.000,00"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Valor total a ser atingido pelo grupo.
                </p>
              </div>

              {/* Valor Já Arrecadado */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-collected-amount" className="text-xs font-semibold text-foreground">
                  Valor Já Arrecadado {activeShare ? "(Atual)" : "(Inicial)"}
                </label>
                <MoneyInput
                  id="goal-collected-amount"
                  cents={initialCollectedCents}
                  onCentsChange={setInitialCollectedCents}
                  placeholder="Ex.: R$ 0,00"
                />
                <p className="text-[11px] text-muted-foreground">
                  Valor já computado no termômetro e no progresso da arrecadação.
                </p>
              </div>

              {/* Data Alvo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Data Alvo <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <DatePicker
                  value={deadline}
                  onValueChange={setDeadline}
                  placeholder="Selecione a data limite"
                  ariaLabel="Data limite para a meta"
                />
                <p className="text-[11px] text-muted-foreground">
                  Habilita contagem regressiva de dias na página pública.
                </p>
              </div>

              {/* Chave Pix */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-pix-key" className="text-xs font-semibold text-foreground">
                  Chave Pix do Organizador
                </label>
                <Input
                  id="goal-pix-key"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="CPF, celular, e-mail ou aleatória"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Destino das contribuições dos participantes.
                </p>
              </div>

              {/* Tipo de Chave Pix */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Tipo de Chave Pix
                </label>
                <Select
                  value={selectedKeyType}
                  onValueChange={setSelectedKeyType}
                  options={PIX_KEY_OPTIONS}
                  ariaLabel="Tipo de Chave Pix"
                />
                <p className="text-[11px] text-muted-foreground">
                  Formatação do identificador BACEN.
                </p>
              </div>

              {/* Nome do Organizador */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-merchant-name" className="text-xs font-semibold text-foreground">
                  Nome do Titular / Organizador
                </label>
                <Input
                  id="goal-merchant-name"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  placeholder="Ex.: Gabriel Sales"
                  required
                />
              </div>

              {/* Cidade do Organizador */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-merchant-city" className="text-xs font-semibold text-foreground">
                  Cidade
                </label>
                <Input
                  id="goal-merchant-city"
                  value={merchantCity}
                  onChange={(e) => setMerchantCity(e.target.value)}
                  placeholder="Ex.: SAO PAULO"
                  required
                />
              </div>
            </div>

            {/* Controle de Visibilidade Pública das Doações */}
            <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  Exibir lista de doadores na página pública
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Permite que qualquer pessoa com o link veja os nomes e quantias arrecadadas. Se desativado, apenas você visualiza a lista no app.
                </p>
              </div>
              <Switch
                checked={showContributionsPublicly}
                onCheckedChange={setShowContributionsPublicly}
                aria-label="Exibir lista de doadores na página pública"
              />
            </div>

            {/* Aviso de Privacidade e Segurança */}
            <div className="rounded-xl border border-border/80 bg-surface/70 p-3 text-xs text-muted-foreground">
              O link gerado é público e somente de leitura. Nenhuma conta bancária, saldo pessoal ou
              transação privada é exposta aos participantes.
            </div>

            <ModalFooter
              destructiveAction={
                activeShare && isEditingGoal ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-critical hover:bg-critical/10"
                    onClick={() => setIsDeleteModalOpen(true)}
                    disabled={isPending}
                  >
                    <Trash2 className="size-3.5 mr-1.5" aria-hidden="true" />
                    <span>Excluir meta</span>
                  </Button>
                ) : null
              }
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (activeShare && isEditingGoal) {
                    setIsEditingGoal(false);
                  } else {
                    onOpenChange(false);
                  }
                }}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={targetCents <= 0 || !pixKey.trim() || isPending}
                aria-label={
                  activeShare && isEditingGoal
                    ? isPending ? "Salvando alterações da meta…" : "Salvar Alterações da Meta"
                    : isPending ? "Gerando link público…" : "Gerar Termômetro Público & Copiar Link"
                }
                title={
                  activeShare && isEditingGoal
                    ? "Salvar alterações da meta"
                    : "Gerar termômetro público e copiar link"
                }
                className="gap-2"
              >
                {activeShare && isEditingGoal ? (
                  <>
                    <Check className="size-4 shrink-0" aria-hidden="true" />
                    <span>{isPending ? "Salvando…" : "Salvar"}</span>
                  </>
                ) : (
                  <>
                    <Share2 className="size-4 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">{isPending ? "Gerando link…" : "Gerar Termômetro"}</span>
                    <span className="sm:hidden">{isPending ? "Gerando…" : "Ativar"}</span>
                  </>
                )}
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* Modal de Confirmação de Revogação */}
      <Modal
        open={isRevokeModalOpen}
        onOpenChange={setIsRevokeModalOpen}
        title="Pausar Link do Termômetro"
        description="Esta ação pausa temporariamente o acesso público à página desta meta."
        size="sm"
      >
        <p className="text-xs text-muted-foreground py-2">
          Os participantes não conseguirão mais consultar o progresso ou a chave Pix por este endereço.
          Você poderá reativar o link público a qualquer momento sem perder seus dados.
        </p>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={() => setIsRevokeModalOpen(false)}>
            Manter ativo
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirmRevoke()}
            disabled={isPending}
          >
            {isPending ? "Pausando…" : "Pausar link"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal de Confirmação de Regeneração */}
      <Modal
        open={isRegenerateModalOpen}
        onOpenChange={setIsRegenerateModalOpen}
        title="Regenerar Link do Termômetro"
        description="Um novo link público será gerado e o link anterior deixará de funcionar."
        size="sm"
      >
        <p className="text-xs text-muted-foreground py-2">
          Recomendado caso você tenha compartilhado o link por engano com pessoas não autorizadas.
        </p>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={() => setIsRegenerateModalOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirmRegenerate()}
            disabled={isPending}
          >
            {isPending ? "Regenerando…" : "Regenerar e copiar"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDialog
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Excluir Meta de Arrecadação?"
        description="Esta ação excluirá permanentemente a meta de arrecadação, o link público e todas as contribuições registradas. Esta ação não poderá ser desfeita."
        confirmLabel={isPending ? "Excluindo…" : "Excluir Meta"}
        variant="destructive"
        confirmPending={isPending}
        onConfirm={() => void handleConfirmDelete()}
      />
    </>
  );
}
